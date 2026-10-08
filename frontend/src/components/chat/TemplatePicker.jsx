import { FileStack, X } from "lucide-react";

export const TemplatePicker = ({ templates, template, setTemplate }) => (
  <label className="flex items-center gap-1.5 text-xs text-slate-600">
    <FileStack size={13} className="text-[#16B8A7]" />
    <select data-testid="template-picker" value={template?.id || ""} onChange={(e) => setTemplate(templates.find((t) => t.id === e.target.value) || null)}
      className="max-w-[200px] rounded-full border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#3FE0D0]">
      <option value="">Usar plantilla…</option>
      {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
  </label>
);

export const TemplateChip = ({ template, onClear }) => (
  <div className="flex items-center gap-2 rounded-lg bg-[#E6FAF8] px-3 py-1.5 text-xs text-[#0F7F75]" data-testid="template-chip">
    <FileStack size={13} />Ori rellenará la plantilla <b>{template.name}</b> ({template.category}). Puedes añadir los datos del caso abajo.
    <button aria-label="Quitar plantilla" data-testid="template-chip-clear" onClick={onClear} className="ml-auto hover:text-[#1B2A3A]"><X size={13} /></button>
  </div>
);
