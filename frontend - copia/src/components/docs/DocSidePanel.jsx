import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, Loader2, X, AlertTriangle } from "lucide-react";
import { api, fileUrl } from "@/lib/api";
import { TextPreview } from "@/components/docs/DocPreviewDialog";

const IMAGES = ["png", "jpg"];
const btn = "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs transition-colors";

const Missing = ({ message, target, units }) => {
  const focused = units.filter((u) => u.ref === target.ref);
  return (
    <div className="flex h-full flex-col gap-3" data-testid="doc-side-missing">
      <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800"><AlertTriangle size={14} />{message}</p>
      {focused.length ? <TextPreview preview={focused} focusRef={target.ref} />
        : <p className="whitespace-pre-wrap rounded-lg border border-[#3FE0D0] bg-[#E6FAF8]/50 p-4 text-sm text-slate-700" data-testid="doc-side-snippet">{target.snippet || "Sin texto disponible para esta referencia."}</p>}
    </div>
  );
};

export const DocSidePanel = ({ target, onClose }) => {
  const [data, setData] = useState(null);
  useEffect(() => {
    setData(null);
    api.get(`/documents/${target.doc_id}`).then((r) => setData(r.data)).catch(() => setData({ error: true }));
  }, [target]);

  const doc = data?.document;
  const type = doc?.file_type;
  const src = doc ? `${fileUrl(doc.id)}${type === "pdf" && target.page ? `#page=${target.page}` : ""}` : "";
  const units = data?.preview || [];

  let body = <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;
  if (data?.error) body = <Missing message="Este documento ya no está en la biblioteca. Se muestra el texto citado." target={target} units={[]} />;
  else if (doc && !doc.has_original) body = <Missing message="No se encuentra el archivo original. Se muestra el texto citado." target={target} units={units} />;
  else if (doc && type === "pdf") body = <iframe key={src} title="documento citado" src={src} className="h-full w-full rounded-lg border border-slate-200" data-testid="doc-side-iframe" />;
  else if (doc && IMAGES.includes(type)) body = <div className="flex h-full justify-center overflow-auto rounded-lg bg-slate-50"><img src={src} alt={doc.file_name} className="max-w-full object-contain" data-testid="doc-side-image" /></div>;
  else if (doc) body = <TextPreview preview={units} focusRef={target.ref} />;

  return (
    <aside data-testid="doc-side-panel" className="ori-slide-in flex h-full w-[42vw] min-w-[360px] max-w-[760px] shrink-0 flex-col border-l border-slate-200 bg-white">
      <header className="flex items-start gap-3 border-b border-slate-200 px-4 py-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E6FAF8] text-[#16B8A7]"><FileText size={16} /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#1B2A3A]" data-testid="doc-side-title" title={doc?.file_name || target.file_name}>{doc?.file_name || target.file_name}</p>
          <p className="text-xs text-slate-500" data-testid="doc-side-ref">Referencia citada: {target.ref}</p>
        </div>
        <button data-testid="doc-side-close" aria-label="Cerrar vista previa" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-[#1B2A3A]"><X size={16} /></button>
      </header>
      {doc?.has_original && (
        <div className="flex gap-2 border-b border-slate-100 px-4 py-2">
          <a data-testid="doc-side-open-tab" href={src} target="_blank" rel="noreferrer" className={`${btn} border border-slate-200 text-[#1B2A3A] hover:border-[#3FE0D0]`}><ExternalLink size={13} />Abrir en pestaña nueva</a>
          <a data-testid="doc-side-download" href={fileUrl(doc.id, true)} className={`${btn} bg-[#1B2A3A] text-white hover:bg-[#14202C]`}><Download size={13} />Descargar</a>
        </div>
      )}
      <div className="min-h-0 flex-1 p-3">{body}</div>
    </aside>
  );
};
