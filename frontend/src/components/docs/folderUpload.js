import { api, errMsg } from "@/lib/api";

const EXTS = ["pdf", "docx", "xlsx", "pptx", "png", "jpg", "jpeg"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const readAll = (reader) => new Promise((res, rej) => {
  const out = [];
  const step = () => reader.readEntries((batch) => { if (!batch.length) res(out); else { out.push(...batch); step(); } }, rej);
  step();
});

export const walkEntries = async (entries) => {
  const out = [];
  const walk = async (entry, prefix) => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory) { for (const c of await readAll(entry.createReader())) await walk(c, path); }
    else out.push({ path, file: await new Promise((res, rej) => entry.file(res, rej)) });
  };
  for (const e of entries) await walk(e, "");
  return out;
};

export const fromInput = (fileList) => [...fileList].map((file) => ({ path: file.webkitRelativePath || file.name, file }));

const withRetry = async (fn, tries = 3) => {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) {
      const s = e.response?.status;
      if (i >= tries || (s && s < 500 && s !== 429)) throw e;
      await sleep(1500 * 2 ** (i - 1));
    }
  }
};

const skipReason = (path) => {
  const parts = path.split("/");
  const name = parts[parts.length - 1];
  if (parts.some((p) => p.startsWith(".") || p.startsWith("~$"))) return "archivo oculto o temporal";
  if (!name.includes(".") || !EXTS.includes(name.split(".").pop().toLowerCase())) return "formato no soportado";
  return null;
};

export const uploadTree = async ({ items, library, profileId, rootId, existing, onProgress }) => {
  const ok = [], skipped = [], errors = [];
  const valid = items.filter(({ path }) => {
    const reason = skipReason(path);
    if (reason) skipped.push({ path, reason });
    return !reason;
  });
  const ids = { "": Promise.resolve(rootId || null) };
  const ensure = (dir) => {
    if (!(dir in ids)) {
      ids[dir] = (async () => {
        const cut = dir.lastIndexOf("/");
        const parent = await ensure(cut < 0 ? "" : dir.slice(0, cut));
        const name = dir.slice(cut + 1).slice(0, 80);
        const found = existing.find((f) => f.name === name && (f.parent_id || null) === parent);
        if (found) return found.id;
        return (await withRetry(() => api.post("/folders", { name, library, profile_id: profileId, parent_id: parent }))).data.id;
      })();
    }
    return ids[dir];
  };
  let done = 0;
  onProgress({ done, total: valid.length });
  const queue = [...valid];
  const worker = async () => {
    while (queue.length) {
      const { path, file } = queue.shift();
      try {
        const cut = path.lastIndexOf("/");
        const folderId = await ensure(cut < 0 ? "" : path.slice(0, cut));
        const fd = new FormData();
        fd.append("files", file, file.name);
        fd.append("library", library);
        fd.append("profile_id", profileId);
        if (folderId) fd.append("folder_id", folderId);
        await withRetry(() => api.post("/documents/upload", fd));
        ok.push(path);
      } catch (e) { errors.push({ path, reason: errMsg(e) }); }
      onProgress({ done: ++done, total: valid.length, current: path });
    }
  };
  await Promise.all([worker(), worker()]);
  return { ok, skipped, errors };
};
