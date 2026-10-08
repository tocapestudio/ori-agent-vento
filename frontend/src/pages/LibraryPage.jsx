import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Upload, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocCard } from "@/components/docs/DocCard";
import { DocEditDialog } from "@/components/docs/DocEditDialog";
import { DocPreviewDialog } from "@/components/docs/DocPreviewDialog";
import { ConfirmDialog } from "@/components/layout/ConfirmDialog";
import { OriHero } from "@/components/ori/OriAvatar";
import { useFolders } from "@/components/docs/useFolders";
import { useFolderActions } from "@/components/docs/useFolderActions";
import { FolderBar } from "@/components/docs/FolderBar";
import { FolderTile } from "@/components/docs/FolderTile";
import { FolderNameDialog } from "@/components/docs/FolderNameDialog";
import { MoveDialog } from "@/components/docs/MoveDialog";
import { SortableList, SortSelect, applyOrder, useOrder } from "@/components/common/Sortable";
import { uploadTree, walkEntries, fromInput } from "@/components/docs/folderUpload";
import { FolderUploadStatus } from "@/components/docs/FolderUploadStatus";
import { FolderUp } from "lucide-react";

const ACCEPT = ".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg";

export default function LibraryPage() {
  const { profile } = useApp();
  const [library, setLibrary] = useState("common");
  const [docs, setDocs] = useState([]);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [current, setCurrent] = useState(null);
  const input = useRef(null);
  const dirInput = useRef(null);
  const [folderUp, setFolderUp] = useState(null);

  const load = useCallback(() => api.get("/documents", { params: { library, profile_id: profile.id } }).then((r) => setDocs(r.data)), [library, profile.id]);
  const folders = useFolders(library, profile.id);
  const fa = useFolderActions({ library, profileId: profile.id, current, setCurrent, folders, reloadDocs: load });
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!docs.some((d) => d.status === "processing")) return;
    const t = setTimeout(load, 3000);
    return () => clearTimeout(t);
  }, [docs, load]);

  const allTags = useMemo(() => [...new Set(docs.flatMap((d) => d.tags))].sort(), [docs]);
  const searching = !!(q.trim() || tag);
  const [sort, setSortState] = useState(() => { try { return localStorage.getItem("ori.library.sort") || "name"; } catch { return "name"; } });
  const setSort = (v) => { setSortState(v); try { localStorage.setItem("ori.library.sort", v); } catch { /* sin almacenamiento */ } };
  const orderBase = `lib:${library === "common" ? "common" : `profile:${profile.id}`}:${current || "root"}`;
  const [folderOrder, saveFolderOrder] = useOrder(`${orderBase}:folders`);
  const [docOrder, saveDocOrder] = useOrder(`${orderBase}:docs`);
  const filteredDocs = docs.filter((d) => {
    if (!searching) return folders.folderOf(d) === current;
    const term = q.toLowerCase();
    const matchQ = !term || d.file_name.toLowerCase().includes(term) || d.tags.some((t) => t.toLowerCase().includes(term));
    return matchQ && (!tag || d.tags.includes(tag));
  });
  const shown = applyOrder(filteredDocs, docOrder, searching && sort === "custom" ? "date" : sort, "file_name", "created_at");
  const subfolders = searching ? [] : applyOrder(folders.childrenOf(current), folderOrder, sort, "name", "created_at");
  const canReorder = sort === "custom" && !searching;
  const libLabel = library === "common" ? "Común" : "Mi biblioteca";
  const deleteSummary = (id) => {
    const tree = folders.descendantsOf(id);
    const n = docs.filter((d) => tree.has(folders.folderOf(d))).length;
    const sub = tree.size - 1;
    if (!n && !sub) return "La carpeta está vacía.";
    return `Se borrarán también ${n} documento(s)${sub ? ` y ${sub} subcarpeta(s)` : ""} que contiene, con sus archivos originales. Esta acción no se puede deshacer.`;
  };
  const pathLabel = (d) => {
    const p = folders.pathOf(folders.folderOf(d)).map((f) => f.name);
    return [libLabel, ...p].join(" / ");
  };

  const upload = async (files) => {
    if (!files?.length) return;
    const fd = new FormData();
    [...files].forEach((f) => fd.append("files", f));
    fd.append("library", library);
    fd.append("profile_id", profile.id);
    if (current) fd.append("folder_id", current);
    setUploading(true);
    try {
      await api.post("/documents/upload", fd);
      toast.success(`${files.length} archivo(s) subidos. Procesando…`);
      load();
    } catch (e) { toast.error(errMsg(e)); }
    finally { setUploading(false); if (input.current) input.current.value = ""; }
  };

  const uploadFolder = async (items) => {
    if (dirInput.current) dirInput.current.value = "";
    if (!items.length || (folderUp && !folderUp.result)) return;
    setFolderUp({ done: 0, total: 0 });
    const result = await uploadTree({ items, library, profileId: profile.id, rootId: current, existing: folders.folders,
      onProgress: (p) => { setFolderUp((s) => ({ ...s, ...p })); if (p.done) load(); } });
    setFolderUp((s) => ({ ...s, result }));
    folders.reload();
    load();
  };

  const saveEdit = async (doc, body) => {
    try { await api.patch(`/documents/${doc.id}`, body); toast.success("Documento actualizado"); setEditing(null); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const remove = async () => { await api.delete(`/documents/${toDelete.id}`); toast.success("Documento eliminado"); setToDelete(null); load(); };
  const reprocess = async (doc) => { await api.post(`/documents/${doc.id}/reprocess`); load(); };

  return (
    <div className="h-full overflow-y-auto bg-[#F8FAFC]" data-testid="library-page"
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } }} onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        setDragging(false);
        const entries = [...(e.dataTransfer.items || [])].map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
        if (entries.some((x) => x.isDirectory)) { e.preventDefault(); walkEntries(entries).then(uploadFolder); }
        else if (e.dataTransfer.files?.length) { e.preventDefault(); upload(e.dataTransfer.files); }
      }}>
      <div className="mx-auto max-w-7xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <h1 className="ori-title text-3xl sm:text-4xl font-bold tracking-tight text-[#1B2A3A]">Biblioteca</h1>
            <p className="text-slate-500 text-sm mt-1">PDF, DOCX, XLSX, PPTX e imágenes. Los escaneados se leen con OCR.</p>
          </div>
          <button data-testid="library-upload-folder-button" onClick={() => dirInput.current?.click()} disabled={!!folderUp && !folderUp.result}
            className="ml-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm text-[#1B2A3A] hover:border-[#3FE0D0] disabled:opacity-60 transition-colors">
            <FolderUp size={16} />Subir carpeta
          </button>
          <input ref={(el) => { dirInput.current = el; el?.setAttribute("webkitdirectory", ""); }} type="file" multiple hidden
            data-testid="library-folder-input" onChange={(e) => uploadFolder(fromInput(e.target.files))} />
          <button data-testid="library-upload-button" onClick={() => input.current?.click()} disabled={uploading}
            className="flex items-center gap-2 rounded-full bg-[#1B2A3A] px-5 py-2.5 text-sm text-white hover:bg-[#14202C] disabled:opacity-60 transition-colors">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Subir aquí
          </button>
          <input ref={input} type="file" multiple hidden accept={ACCEPT} data-testid="library-file-input" onChange={(e) => upload(e.target.files)} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={library} onValueChange={(v) => { setLibrary(v); setTag(""); setCurrent(null); }}>
            <TabsList>
              <TabsTrigger value="common" data-testid="library-tab-common">Común</TabsTrigger>
              <TabsTrigger value="mine" data-testid="library-tab-mine">Mi biblioteca</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input data-testid="library-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o etiqueta"
              className="w-full rounded-full border border-slate-200 bg-white pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3FE0D0]" />
          </div>
          <select data-testid="library-tag-filter" value={tag} onChange={(e) => setTag(e.target.value)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3FE0D0]">
            <option value="">Todas las etiquetas</option>
            {allTags.map((t) => <option key={t} value={t}>#{t}</option>)}
          </select>
          <SortSelect value={sort} onChange={setSort} testId="library-sort-select" />
          {tag && <button data-testid="library-clear-tag" onClick={() => setTag("")} className="flex items-center gap-1 text-xs text-slate-500 hover:text-[#1B2A3A]"><X size={12} />Quitar filtro</button>}
        </div>
        <div className={`rounded-2xl border-2 border-dashed px-6 py-5 text-center text-sm transition-colors ${dragging ? "border-[#3FE0D0] bg-[#E6FAF8]" : "border-slate-200 text-slate-400"}`} data-testid="library-dropzone">
          Arrastra archivos o carpetas aquí para subirlos a <b className="text-[#1B2A3A]" data-testid="upload-destination">{[libLabel, ...folders.pathOf(current).map((f) => f.name)].join(" / ")}</b>
        </div>
        <FolderUploadStatus state={folderUp} onClose={() => setFolderUp(null)} />
        {searching ? (
          <p className="text-sm text-slate-500" data-testid="search-scope-hint">Resultados en todas las carpetas de {libLabel}</p>
        ) : (
          <FolderBar path={folders.pathOf(current)} current={current} onOpen={setCurrent} onDropDoc={fa.moveDoc}
            onNewFolder={() => fa.setNameDialog({ folder: null })} libraryLabel={libLabel} />
        )}
        {subfolders.length > 0 && (
          <div data-testid="folder-grid">
            <SortableList items={subfolders} onReorder={saveFolderOrder} disabled={!canReorder} testPrefix="folder-sort" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" itemClassName={() => "h-full"}
              render={(f, grip) => (
              <FolderTile folder={f} grip={grip} docCount={docs.filter((d) => folders.folderOf(d) === f.id).length}
                subCount={folders.childrenOf(f.id).length} onOpen={setCurrent} onDropDoc={fa.moveDoc}
                onRename={(x) => fa.setNameDialog({ folder: x })} onMove={fa.openFolderMove} onDelete={fa.setToDelete} />
            )} />
          </div>
        )}
        {shown.length === 0 && subfolders.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center" data-testid="library-empty">
            <OriHero expression="wink" className="h-48" />
            <p className="text-slate-500 text-sm">{searching ? "Ningún documento coincide con el filtro." : "Esta carpeta está vacía. ¡Sube el primer documento!"}</p>
          </div>
        ) : (
          <div data-testid="library-grid">
            <SortableList items={shown} onReorder={saveDocOrder} disabled={!canReorder} testPrefix="doc-sort" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" itemClassName={() => "h-full"}
              render={(d, grip) => (
              <DocCard doc={d} grip={grip} onPreview={(x) => setPreview({ doc_id: x.id, file_name: x.file_name })}
                onEdit={setEditing} onDelete={setToDelete} onReprocess={reprocess} onTag={setTag}
                onMove={fa.openDocMove} path={searching ? pathLabel(d) : null} />
            )} />
          </div>
        )}
      </div>
      <FolderNameDialog open={!!fa.nameDialog} title={fa.nameDialog?.folder ? "Renombrar carpeta" : "Nueva carpeta"}
        initial={fa.nameDialog?.folder?.name || ""} onClose={() => fa.setNameDialog(null)} onSave={fa.saveName} />
      <MoveDialog target={fa.moveTarget} folders={folders} onClose={() => fa.setMoveTarget(null)} onMove={fa.confirmMove} />
      <ConfirmDialog open={!!fa.toDelete} onOpenChange={(o) => !o && fa.setToDelete(null)} onConfirm={fa.deleteFolder}
        testId="folder-delete-confirm" confirmLabel="Eliminar carpeta" title={`¿Eliminar la carpeta "${fa.toDelete?.name}"?`}
        description={fa.toDelete ? deleteSummary(fa.toDelete.id) : ""} />
      <DocEditDialog doc={editing} onClose={() => setEditing(null)} onSave={saveEdit} />
      <DocPreviewDialog target={preview} onClose={() => setPreview(null)} />
      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} onConfirm={remove} testId="doc-delete-confirm"
        title={`¿Eliminar "${toDelete?.file_name}"?`} description="Se borrará el archivo original y su contenido indexado." />
    </div>
  );
}
