import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, MessageSquarePlus, Search, Users, User } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { TemplateDialog, TEMPLATE_CATEGORIES, placeholdersOf } from "@/components/templates/TemplateDialog";
import { ConfirmDialog } from "@/components/layout/ConfirmDialog";
import { OriHero } from "@/components/ori/OriAvatar";
import { SortableList, SortSelect, applyOrder, useOrder } from "@/components/common/Sortable";

const TemplateCard = ({ t, onEdit, onDelete, onUse, grip }) => (
  <div data-testid={`template-card-${t.id}`} className="h-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3 ori-fade">
    <div className="flex items-start gap-2">
      {grip}
      <h3 className="ori-title flex-1 font-semibold text-[#1B2A3A]" data-testid={`template-name-${t.id}`}>{t.name}</h3>
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600" data-testid={`template-visibility-badge-${t.id}`}>
        {t.scope === "common" ? <><Users size={11} />Común</> : <><User size={11} />Personal</>}
      </span>
    </div>
    <span className="w-fit rounded-full bg-[#E6FAF8] px-2 py-0.5 text-[11px] text-[#0F7F75]">{t.category}</span>
    <pre className="line-clamp-5 whitespace-pre-wrap font-sans text-xs text-slate-500">{t.body}</pre>
    <p className="text-[11px] text-slate-400">{placeholdersOf(t.body).length} marcadores</p>
    <div className="flex items-center gap-1 border-t border-slate-100 pt-2">
      <button data-testid={`template-use-${t.id}`} onClick={() => onUse(t)} className="flex items-center gap-1.5 rounded-full bg-[#3FE0D0] px-3 py-1 text-xs text-[#1B2A3A] hover:brightness-95"><MessageSquarePlus size={13} />Usar en chat</button>
      <span className="ml-auto" />
      <button aria-label="Editar" data-testid={`template-edit-${t.id}`} onClick={() => onEdit(t)} className="h-8 w-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100"><Pencil size={15} /></button>
      <button aria-label="Eliminar" data-testid={`template-delete-${t.id}`} onClick={() => onDelete(t)} className="h-8 w-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-red-600"><Trash2 size={15} /></button>
    </div>
  </div>
);

export default function TemplatesPage() {
  const { profile } = useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [dialog, setDialog] = useState({ open: false, initial: null });
  const [toDelete, setToDelete] = useState(null);

  const load = useCallback(() => api.get("/templates", { params: { profile_id: profile.id } }).then((r) => setItems(r.data)), [profile.id]);
  useEffect(() => { load(); }, [load]);

  const save = async (f) => {
    try {
      const body = { ...f, profile_id: profile.id };
      if (dialog.initial) await api.patch(`/templates/${dialog.initial.id}`, body);
      else await api.post("/templates", body);
      toast.success("Plantilla guardada");
      setDialog({ open: false, initial: null });
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const remove = async () => { await api.delete(`/templates/${toDelete.id}`, { params: { profile_id: profile.id } }); setToDelete(null); toast.success("Plantilla eliminada"); load(); };
  const [order, saveOrder] = useOrder("templates:shared");
  const [sort, setSort] = useState("custom");
  const filtered = items.filter((t) => (!cat || t.category === cat) && (!q || `${t.name} ${t.body}`.toLowerCase().includes(q.toLowerCase())));
  const shown = applyOrder(filtered, order, sort, "name", "created_at");

  return (
    <div className="h-full overflow-y-auto bg-[#F8FAFC]" data-testid="templates-page">
      <div className="mx-auto max-w-7xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <h1 className="ori-title text-3xl sm:text-4xl font-bold tracking-tight text-[#1B2A3A]">Plantillas</h1>
            <p className="text-slate-500 text-sm mt-1">Informes, protocolos y planes con tu estructura. Ori los rellena desde el chat.</p>
          </div>
          <button data-testid="template-create-button" onClick={() => setDialog({ open: true, initial: null })}
            className="ml-auto flex items-center gap-2 rounded-full bg-[#1B2A3A] px-5 py-2.5 text-sm text-white hover:bg-[#14202C]"><Plus size={16} />Nueva plantilla</button>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input data-testid="template-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar plantillas"
              className="w-full rounded-full border border-slate-200 bg-white pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3FE0D0]" />
          </div>
          <select data-testid="template-category-filter" value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm">
            <option value="">Todas las categorías</option>{TEMPLATE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <SortSelect value={sort} onChange={setSort} testId="template-sort-select" />
        </div>
        {shown.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center" data-testid="templates-empty"><OriHero expression="wink" className="h-48" /><p className="text-sm text-slate-500">No hay plantillas que coincidan.</p></div>
        ) : (
          <div data-testid="templates-grid">
            <SortableList items={shown} onReorder={saveOrder} disabled={sort !== "custom"} testPrefix="template-sort" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              render={(t, grip) => <TemplateCard t={t} grip={grip} onEdit={(x) => setDialog({ open: true, initial: x })} onDelete={setToDelete} onUse={(x) => navigate(`/chat?tpl=${x.id}`)} />} />
          </div>
        )}
      </div>
      <TemplateDialog open={dialog.open} initial={dialog.initial} onClose={() => setDialog({ open: false, initial: null })} onSave={save} />
      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} onConfirm={remove} testId="template-delete-confirm"
        title={`¿Eliminar la plantilla "${toDelete?.name}"?`} description="Esta acción no se puede deshacer." />
    </div>
  );
}
