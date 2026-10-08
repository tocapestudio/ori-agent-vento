import { AlertTriangle } from "lucide-react";

export const CalcCard = ({ id, title, icon: Icon, children, formula, reference }) => (
  <section data-testid={`calc-${id}`} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-4 ori-fade">
    <h2 className="ori-title flex items-center gap-2 text-lg font-semibold text-[#1B2A3A]">{Icon && <Icon size={18} className="text-[#16B8A7]" />}{title}</h2>
    <div className="flex-1 space-y-4">{children}</div>
    <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500 space-y-1" data-testid={`calc-${id}-formula`}>
      <p><span className="font-semibold text-slate-600">Fórmula:</span> <code className="text-[#1B2A3A]">{formula}</code></p>
      <p><span className="font-semibold text-slate-600">Referencia:</span> {reference}</p>
    </div>
  </section>
);

export const NumField = ({ id, label, value, onChange, unit, placeholder }) => (
  <label className="block space-y-1 text-sm">
    <span className="text-slate-600">{label}</span>
    <div className="relative">
      <input data-testid={id} type="number" step="any" inputMode="decimal" value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-[#3FE0D0]" />
      {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{unit}</span>}
    </div>
  </label>
);

export const SelectField = ({ id, label, value, onChange, options }) => (
  <label className="block space-y-1 text-sm">
    <span className="text-slate-600">{label}</span>
    <select data-testid={id} value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3FE0D0]">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  </label>
);

export const Result = ({ id, label, value, tone = "default" }) => {
  const tones = { default: "bg-[#E6FAF8] text-[#0F7F75]", warn: "bg-amber-50 text-amber-800", ok: "bg-emerald-50 text-emerald-800" };
  return (
    <div className={`rounded-lg px-4 py-3 ${tones[tone]}`} data-testid={id}>
      <p className="text-[11px] uppercase tracking-wider font-semibold opacity-70">{label}</p>
      <p className="ori-title text-xl font-semibold">{value}</p>
    </div>
  );
};

export const Invalid = ({ msg, id }) => msg ? (
  <p className="flex items-center gap-1.5 text-xs text-red-600" data-testid={id}><AlertTriangle size={13} />{msg}</p>
) : null;

export const Grid = ({ children, cols = 2 }) => <div className={`grid gap-3 ${cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>{children}</div>;
