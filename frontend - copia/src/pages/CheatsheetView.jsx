import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Save, RefreshCw, Copy, Printer, LibraryBig, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { copyText } from "@/lib/clipboard";
import { useApp } from "@/context/AppContext";
import { Markdown } from "@/components/common/Markdown";
import { OriHero } from "@/components/ori/OriAvatar";
import { ConfirmDialog } from "@/components/layout/ConfirmDialog";
import { CHEAT_FORMATS } from "@/components/cheatsheets/NewCheatsheetDialog";

const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3FE0D0]";
const Btn = ({ testId, onClick, icon: Icon, children, disabled }) => (
  <button data-testid={testId} onClick={onClick} disabled={disabled} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-[#3FE0D0] hover:text-[#1B2A3A] disabled:opacity-50"><Icon size={13} />{children}</button>
);

export default function CheatsheetView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useApp();
  const [c, setC] = useState(null);
  const [edit, setEdit] = useState(null);
  const [regen, setRegen] = useState(null);
  const [del, setDel] = useState(false);

  const load = useCallback(() => api.get(`/cheatsheets/${id}`).then((r) => setC(r.data)).catch(() => navigate("/chuletas")), [id, navigate]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (c?.status !== "generating") return;
    const t = setTimeout(load, 2500);
    return () => clearTimeout(t);
  }, [c, load]);
  if (!c) return null;

  const act = async (fn, ok) => { try { await fn(); if (ok) toast.success(ok); load(); } catch (e) { toast.error(errMsg(e)); } };
  const saveEdit = () => act(async () => { await api.patch(`/cheatsheets/${id}`, { title: edit.title, content: edit.content, tags: edit.tags.split(",").map((t) => t.trim()).filter(Boolean) }); setEdit(null); }, "Chuleta guardada");
  const doRegen = () => act(async () => { await api.post(`/cheatsheets/${id}/regenerate`, regen); setRegen(null); }, "Regenerando chuleta…");
  const toLibrary = () => act(() => api.post(`/cheatsheets/${id}/save-to-library`, null, { params: { profile_id: profile.id } }), "Guardada en la biblioteca: Ori ya puede usarla");
  const copy = async () => toast[(await copyText(c.content)) ? "success" : "error"]("Chuleta copiada");

  return (
    <div className="h-full overflow-y-auto bg-[#F8FAFC]" data-testid="cheat-view-page">
      <div className="mx-auto max-w-4xl p-6 sm:p-8 space-y-4">
        <div className="no-print flex flex-wrap items-center gap-2" data-testid="cheat-toolbar">
          <button data-testid="cheat-back" onClick={() => navigate("/chuletas")} className="mr-auto flex items-center gap-1 text-sm text-slate-500 hover:text-[#1B2A3A]"><ArrowLeft size={15} />Chuletas</button>
          {c.status === "ready" && !edit && <>
            <Btn testId="cheat-edit" icon={Pencil} onClick={() => setEdit({ title: c.title, content: c.content, tags: c.tags.join(", ") })}>Editar</Btn>
            <Btn testId="cheat-copy" icon={Copy} onClick={copy}>Copiar</Btn>
            <Btn testId="cheat-print" icon={Printer} onClick={() => window.print()}>Imprimir A4</Btn>
            <Btn testId="cheat-save-library" icon={LibraryBig} onClick={toLibrary}>{c.library_doc_id ? "Actualizar en biblioteca" : "Guardar en biblioteca"}</Btn>
          </>}
          {c.status !== "generating" && !edit && <Btn testId="cheat-regenerate" icon={RefreshCw} onClick={() => setRegen({ instructions: c.instructions, format: c.format })}>Regenerar</Btn>}
          {edit && <Btn testId="cheat-save-edit" icon={Save} onClick={saveEdit}>Guardar cambios</Btn>}
          <Btn testId="cheat-delete" icon={Trash2} onClick={() => setDel(true)}>Eliminar</Btn>
        </div>
        {regen && (
          <div className="no-print space-y-2 rounded-xl border border-[#3FE0D0]/50 bg-white p-4" data-testid="cheat-regen-panel">
            <textarea data-testid="cheat-regen-instructions" rows={3} value={regen.instructions} onChange={(e) => setRegen({ ...regen, instructions: e.target.value })} className={field} />
            <div className="flex gap-2">
              <select data-testid="cheat-regen-format" value={regen.format} onChange={(e) => setRegen({ ...regen, format: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">{CHEAT_FORMATS.map((x) => <option key={x}>{x}</option>)}</select>
              <button data-testid="cheat-regen-submit" onClick={doRegen} className="rounded-full bg-[#1B2A3A] px-4 py-2 text-sm text-white">Regenerar</button>
              <button onClick={() => setRegen(null)} className="text-sm text-slate-500">Cancelar</button>
            </div>
          </div>
        )}
        <article className="print-area rounded-xl border border-slate-200 bg-white p-8 shadow-sm" data-testid="cheat-content">
          {edit ? (
            <div className="space-y-3">
              <input data-testid="cheat-edit-title" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className={`${field} font-semibold`} />
              <input data-testid="cheat-edit-tags" value={edit.tags} onChange={(e) => setEdit({ ...edit, tags: e.target.value })} placeholder="Etiquetas" className={field} />
              <textarea data-testid="cheat-edit-content" value={edit.content} onChange={(e) => setEdit({ ...edit, content: e.target.value })} className={`${field} min-h-[55vh] font-mono text-xs`} />
            </div>
          ) : <>
            <header className="mb-4 border-b border-slate-100 pb-3">
              <p className="ori-title text-2xl font-bold text-[#1B2A3A]" data-testid="cheat-view-title">{c.title}</p>
              <p className="mt-1 text-xs text-slate-500">Fuentes: {c.sources.join(" · ")} — {c.created_by_name}, {new Date(c.updated_at).toLocaleDateString("es-ES")} · Generado por Ori (apoyo; verifica el criterio clínico)</p>
            </header>
            {c.status === "generating" && <div className="flex flex-col items-center py-10" data-testid="cheat-generating"><OriHero expression="thinking" className="h-40" /><p className="text-sm text-slate-500">Ori está preparando la chuleta…</p></div>}
            {c.status === "error" && <p className="flex items-center gap-2 text-sm text-red-600" data-testid="cheat-error"><AlertCircle size={15} />{c.error}</p>}
            {c.status === "ready" && <Markdown>{c.content}</Markdown>}
          </>}
        </article>
      </div>
      <ConfirmDialog open={del} onOpenChange={setDel} testId="cheat-delete-confirm" title="¿Eliminar esta chuleta?" description="Si la guardaste en la biblioteca, ese documento se mantiene."
        onConfirm={() => act(async () => { await api.delete(`/cheatsheets/${id}`); navigate("/chuletas"); }, "Chuleta eliminada")} />
    </div>
  );
}
