import { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, fileUrl } from "@/lib/api";

const VIEWABLE = ["pdf", "png", "jpg"];

export const TextPreview = ({ preview, focusRef }) => {
  const box = useRef(null);
  useEffect(() => {
    const el = box.current?.querySelector('[data-focus="true"]');
    el?.scrollIntoView({ block: "start" });
  }, [preview, focusRef]);
  return (
    <div ref={box} className="h-full overflow-y-auto space-y-4 pr-2" data-testid="doc-preview-text">
      {preview.length === 0 && <p className="text-sm text-slate-400">Sin texto extraído todavía.</p>}
      {preview.map((u) => (
        <section key={u.ref} data-focus={u.ref === focusRef} className={`rounded-lg border p-4 ${u.ref === focusRef ? "border-[#3FE0D0] bg-[#E6FAF8]/50" : "border-slate-200"}`}>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2">{u.ref}</p>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{u.text}</p>
        </section>
      ))}
    </div>
  );
};

export const DocPreviewDialog = ({ target, onClose }) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    if (target) api.get(`/documents/${target.doc_id}`).then((r) => setData(r.data)).catch(() => setData({ error: true }));
  }, [target]);

  const doc = data?.document;
  const viewable = doc?.has_original && VIEWABLE.includes(doc.file_type);
  const src = doc ? `${fileUrl(doc.id)}${doc.file_type === "pdf" && target?.page ? `#page=${target.page}` : ""}` : "";

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl h-[86vh] flex flex-col" data-testid="doc-preview-dialog">
        <DialogHeader>
          <DialogTitle className="ori-title pr-8 truncate" data-testid="doc-preview-title">{doc?.file_name || target?.file_name}</DialogTitle>
          <DialogDescription>{target?.ref ? `Referencia citada: ${target.ref}` : "Vista previa del documento"}</DialogDescription>
        </DialogHeader>
        {!data && <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" /></div>}
        {data?.error && <p className="text-sm text-red-600" data-testid="doc-preview-error">No se pudo cargar el documento (puede haber sido eliminado).</p>}
        {doc && (
          <Tabs defaultValue={viewable ? "original" : "text"} className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-center gap-3">
              <TabsList>
                {viewable && <TabsTrigger value="original" data-testid="doc-preview-tab-original">Original</TabsTrigger>}
                <TabsTrigger value="text" data-testid="doc-preview-tab-text">Texto extraído</TabsTrigger>
              </TabsList>
              {doc.has_original ? (
                <a href={fileUrl(doc.id, true)} data-testid="doc-preview-download" className="ml-auto flex items-center gap-1.5 rounded-full bg-[#1B2A3A] px-4 py-1.5 text-xs text-white hover:bg-[#14202C]"><Download size={13} />Descargar original</a>
              ) : <span className="ml-auto text-xs text-slate-400">Original no disponible</span>}
            </div>
            {viewable && (
              <TabsContent value="original" className="flex-1 min-h-0 mt-3">
                {doc.file_type === "pdf"
                  ? <iframe title="original" src={src} className="h-full w-full rounded-lg border border-slate-200" data-testid="doc-preview-iframe" />
                  : <div className="h-full overflow-auto flex justify-center bg-slate-50 rounded-lg"><img src={src} alt={doc.file_name} className="max-w-full object-contain" data-testid="doc-preview-image" /></div>}
              </TabsContent>
            )}
            <TabsContent value="text" className="flex-1 min-h-0 mt-3"><TextPreview preview={data.preview} focusRef={target?.ref} /></TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
