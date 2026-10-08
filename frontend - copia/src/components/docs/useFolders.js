import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

export const DOC_DRAG_TYPE = "application/x-ori-doc";

export const useFolders = (library, profileId) => {
  const [folders, setFolders] = useState([]);
  const reload = useCallback(
    () => api.get("/folders", { params: { library, profile_id: profileId } }).then((r) => setFolders(r.data)),
    [library, profileId]
  );
  useEffect(() => { reload(); }, [reload]);

  return useMemo(() => {
    const byId = Object.fromEntries(folders.map((f) => [f.id, f]));
    const childrenOf = (pid) => folders.filter((f) => (byId[f.parent_id] ? f.parent_id : null) === (pid || null));
    const pathOf = (id) => {
      const out = [];
      let cur = byId[id];
      while (cur && out.length < 50) { out.unshift(cur); cur = byId[cur.parent_id]; }
      return out;
    };
    const descendantsOf = (id) => {
      const set = new Set([id]);
      let grew = true;
      while (grew) {
        grew = false;
        folders.forEach((f) => { if (set.has(f.parent_id) && !set.has(f.id)) { set.add(f.id); grew = true; } });
      }
      return set;
    };
    const folderOf = (doc) => (byId[doc.folder_id] ? doc.folder_id : null);
    return { folders, byId, childrenOf, pathOf, descendantsOf, folderOf, reload };
  }, [folders, reload]);
};
