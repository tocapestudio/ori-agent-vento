import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export const TEMPLATE_CATEGORIES = ["Informe", "Protocolo terapia visual", "Plan entrenamiento deportivo", "Contactología", "Audiología", "Investigación", "Otro"];
const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3FE0D0]";

export const placeholdersOf = (body = "") => [...new Set([...body.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map((m) => m[1]))];

export const TemplateDialog = ({ open, initial, onClose, onSave }) => {
  const [f, setF] = useState({ name: "", category: "Informe", body: "", visibility: "common" });
  const area = useRef(null);
  useEffect(() => {
    if (open) setF(initial ? { name: initial.name, category: initial.category, body: initial.body, visibility: initial.scope === "common" ? "common" : "mine" }
      : { name: "", category: "Informe", body: "# Título\n\n## Sección 1\n{{dato_1}}\n", visibility: "common" });
  }, [open, initial]);
  const ph = useMemo(() => placeholdersOf(f.body), [f.body]);

  const insert = (text) => {
    const el = area.current;
    const pos = el ? el.selectionStart : f.body.length;
    setF({ ...f, body: f.body.slice(0, pos) + text + f.body.slice(pos) });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="template-dialog" className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="ori-title">{initial ? "Editar plantilla" : "Nueva plantilla"}</DialogTitle>
          <DialogDescription>Usa secciones (## Título) y marcadores {"{{dato}}"}. Ori mantiene la estructura y marca [pendiente] lo que falte.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="sm:col-span-3 block space-y-1 text-sm"><span className="text-slate-600">Nombre</span>
            <input data-testid="template-name-input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={field} /></label>
          <label className="block space-y-1 text-sm sm:col-span-2"><span className="text-slate-600">Categoría</span>
            <select data-testid="template-category-select" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className={`${field} bg-white`}>
              {TEMPLATE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select></label>
          <div className="space-y-1 text-sm"><span className="text-slate-600">Visibilidad</span>
            <div className="flex rounded-full bg-slate-100 p-0.5" data-testid="template-visibility">
              {[["common", "Común"], ["mine", "Personal"]].map(([v, l]) => (
                <button key={v} type="button" data-testid={`template-visibility-${v}`} onClick={() => setF({ ...f, visibility: v })}
                  className={`flex-1 rounded-full px-3 py-1.5 text-xs transition-colors ${f.visibility === v ? "bg-[#1B2A3A] text-white" : "text-slate-600"}`}>{l}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-600 mr-auto">Contenido</span>
            <button type="button" data-testid="template-insert-section" onClick={() => insert("\n## Nueva sección\n")} className="rounded-full border border-slate-200 px-3 py-1 text-xs hover:border-[#3FE0D0]">+ Sección</button>
            <button type="button" data-testid="template-insert-placeholder" onClick={() => insert("{{dato}}")} className="rounded-full border border-slate-200 px-3 py-1 text-xs hover:border-[#3FE0D0]">+ Marcador</button>
          </div>
          <textarea ref={area} data-testid="template-body-input" rows={14} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className={`${field} font-mono text-xs leading-relaxed`} />
          <div className="flex flex-wrap gap-1.5" data-testid="template-placeholders">
            {ph.length === 0 ? <span className="text-xs text-slate-400">Sin marcadores.</span> : ph.map((p) => <span key={p} className="rounded-full bg-[#E6FAF8] px-2 py-0.5 text-[11px] text-[#0F7F75]">{`{{${p}}}`}</span>)}
          </div>
        </div>
        <DialogFooter>
          <button data-testid="template-save-button" disabled={!f.name.trim() || !f.body.trim()} onClick={() => onSave(f)}
            className="rounded-full bg-[#1B2A3A] px-5 py-2 text-sm text-white hover:bg-[#14202C] disabled:opacity-50">Guardar</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
