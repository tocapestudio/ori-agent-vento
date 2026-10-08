import { Loader2, X, CheckCircle2 } from "lucide-react";

const List = ({ title, items, testId, cls }) => items.length > 0 && (
  <details className="mt-2" data-testid={testId}>
    <summary className={`cursor-pointer text-xs font-medium ${cls}`}>{title} ({items.length})</summary>
    <ul className="mt-1 max-h-40 overflow-y-auto space-y-0.5 text-xs text-slate-500">
      {items.map((x) => <li key={x.path} className="truncate">{x.path} <span className="text-slate-400">— {x.reason}</span></li>)}
    </ul>
  </details>
);

export const FolderUploadStatus = ({ state, onClose }) => {
  if (!state) return null;
  const { done, total, current, result } = state;
  return (
    <div data-testid="folder-upload-status" className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm ori-fade">
      {!result ? (
        <>
          <div className="flex items-center gap-2 text-[#1B2A3A]">
            <Loader2 size={15} className="animate-spin text-[#16B8A7]" />
            <span data-testid="folder-upload-progress">Subiendo carpeta: {done} de {total} archivos…</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-[#3FE0D0] transition-[width]" style={{ width: `${total ? (done * 100) / total : 0}%` }} />
          </div>
          {current && <p className="mt-1 truncate text-xs text-slate-400">{current}</p>}
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span className="font-medium text-[#1B2A3A]" data-testid="folder-upload-summary">
              Carpeta subida: {result.ok.length} subidos · {result.skipped.length} omitidos · {result.errors.length} errores
            </span>
            <button aria-label="Cerrar" data-testid="folder-upload-close" onClick={onClose} className="ml-auto rounded-full p-1 text-slate-400 hover:bg-slate-100"><X size={14} /></button>
          </div>
          <p className="mt-1 text-xs text-slate-500">Los documentos se procesan en segundo plano (OCR en cola para respetar el límite gratuito).</p>
          <List title="Omitidos" items={result.skipped} testId="folder-upload-skipped" cls="text-amber-700" />
          <List title="Errores" items={result.errors} testId="folder-upload-errors" cls="text-red-600" />
        </>
      )}
    </div>
  );
};
