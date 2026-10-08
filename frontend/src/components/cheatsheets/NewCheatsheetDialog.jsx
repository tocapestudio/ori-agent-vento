import { useEffect, useMemo, useState } from "react";
import { Search, Check } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { api, errMsg } from "@/lib/api";
import { useApp } from "@/context/AppContext";

export const CHEAT_FORMATS = ["Resumen", "Tabla", "Esquema", "Preguntas-respuesta", "Libre"];
const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3FE0D0]";

export const NewCheatsheetDialog = ({ open, onClose, preselect = [], library, onCreated }) => {
  const { profile } = useApp();
  const [docs, setDocs] = useState([]);
  const [sel, setSel] = useState(new Set());
  const [q, setQ] = useState("");
  const [f, setF] = useState({ title: "", instructions: "", format: "Tabla", tags: "", library });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSel(new Set(preselect));
    setF((x) => ({ ...x, library }));
    Promise.all(["common", "mine"].map((lib) => api.get("/documents", { params: { library: lib, profile_id: profile.id } })
      .then((r) => r.data.map((d) => ({ ...d, lib: lib === "common" ? "Común" : "Mi biblioteca" })))))
      .then((all) => setDocs(all.flat().filter((d) => d.status === "ready")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const shown = useMemo(() => docs.filter((d) => !q || `${d.file_name} ${d.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase())), [docs, q]);
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/cheatsheets", { doc_ids: [...sel], instructions: f.instructions, format: f.format, title: f.title || null,
        tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean), library: f.library, profile_id: profile.id });
      onCreated(data.id);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="cheat-new-dialog" className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="ori-title">Hacer chuleta</DialogTitle>
          <DialogDescription>Ori la redacta usando solo los documentos que elijas, con citas de página.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input data-testid="cheat-doc-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar documentos" className={`${field} pl-8`} /></div>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-1" data-testid="cheat-doc-list">
            {shown.length === 0 && <p className="p-3 text-sm text-slate-400">No hay documentos listos.</p>}
            {shown.map((d) => (
              <button key={d.id} type="button" data-testid={`cheat-doc-option-${d.id}`} onClick={() => toggle(d.id)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm ${sel.has(d.id) ? "bg-[#E6FAF8]" : "hover:bg-slate-50"}`}>
                <span className={`flex h-4 w-4 items-center justify-center rounded border ${sel.has(d.id) ? "border-[#16B8A7] bg-[#16B8A7] text-white" : "border-slate-300"}`}>{sel.has(d.id) && <Check size={11} />}</span>
                <span className="flex-1 truncate">{d.file_name}</span><span className="text-[11px] text-slate-400">{d.lib}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500" data-testid="cheat-selected-count">{sel.size} documento(s) seleccionado(s) (máx. 10)</p>
        </div>
        <textarea data-testid="cheat-instructions" rows={3} value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })}
          placeholder="Ej.: tabla resumen de tests acomodativos con valores normales" className={field} />
        <div className="grid gap-3 sm:grid-cols-4">
          <select data-testid="cheat-format" value={f.format} onChange={(e) => setF({ ...f, format: e.target.value })} className={`${field} bg-white`}>
            {CHEAT_FORMATS.map((x) => <option key={x}>{x}</option>)}</select>
          <input data-testid="cheat-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Título (opcional)" className={`${field} sm:col-span-2`} />
          <select data-testid="cheat-library" value={f.library} onChange={(e) => setF({ ...f, library: e.target.value })} className={`${field} bg-white`}>
            <option value="common">Guardar en Común</option><option value="mine">Guardar en Mis chuletas</option></select>
          <input data-testid="cheat-tags" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} placeholder="Etiquetas (coma)" className={`${field} sm:col-span-4`} />
        </div>
        <DialogFooter>
          <button data-testid="cheat-generate-button" disabled={busy || !sel.size || sel.size > 10 || f.instructions.trim().length < 3} onClick={submit}
            className="rounded-full bg-[#1B2A3A] px-5 py-2 text-sm text-white hover:bg-[#14202C] disabled:opacity-50">Generar chuleta</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
