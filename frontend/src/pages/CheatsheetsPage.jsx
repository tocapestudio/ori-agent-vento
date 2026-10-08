import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, Loader2, AlertCircle, FileText, NotebookPen } from "lucide-react";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NewCheatsheetDialog } from "@/components/cheatsheets/NewCheatsheetDialog";
import { OriHero } from "@/components/ori/OriAvatar";
import { SortableList, SortSelect, applyOrder, useOrder } from "@/components/common/Sortable";

const fmtDate = (iso) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

const CheatCard = ({ c, onOpen, grip }) => (
  <div data-testid={`cheat-card-${c.id}`} onClick={() => onOpen(c)} className="h-full cursor-pointer rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2 ori-fade">
    <div className="flex items-start gap-2">
      {grip}
      <NotebookPen size={18} className="mt-0.5 shrink-0 text-[#16B8A7]" />
      <h3 className="ori-title flex-1 font-semibold text-[#1B2A3A] line-clamp-2" data-testid={`cheat-title-${c.id}`}>{c.title}</h3>
      {c.status !== "ready" && (
        <span data-testid={`cheat-status-${c.id}`} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${c.status === "error" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>
          {c.status === "error" ? <AlertCircle size={11} /> : <Loader2 size={11} className="animate-spin" />}{c.status === "error" ? "Error" : "Generando"}
        </span>
      )}
    </div>
    <span className="w-fit rounded-full bg-[#E6FAF8] px-2 py-0.5 text-[11px] text-[#0F7F75]">{c.format}</span>
    <ul className="space-y-0.5 text-xs text-slate-500">{c.sources.slice(0, 3).map((s) => <li key={s} className="flex items-center gap-1 truncate"><FileText size={11} className="shrink-0" />{s}</li>)}
      {c.sources.length > 3 && <li>+{c.sources.length - 3} más</li>}</ul>
    <div className="flex flex-wrap gap-1">{c.tags.map((t) => <span key={t} className="rounded-full bg-[#1B2A3A]/5 px-2 py-0.5 text-[11px]">#{t}</span>)}</div>
    <p className="mt-auto text-[11px] text-slate-400">{c.created_by_name} · {fmtDate(c.created_at)}</p>
  </div>
);

export default function CheatsheetsPage() {
  const { profile } = useApp();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const preselect = sp.get("docs") ? sp.get("docs").split(",") : [];
  const [library, setLibrary] = useState("common");
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(preselect.length > 0);

  const reqId = useRef(0);
  const load = useCallback(() => {
    const id = ++reqId.current;
    return api.get("/cheatsheets", { params: { library, profile_id: profile.id } }).then((r) => { if (id === reqId.current) setItems(r.data); });
  }, [library, profile.id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!items.some((c) => c.status === "generating")) return;
    const t = setTimeout(load, 3000);
    return () => clearTimeout(t);
  }, [items, load]);

  const [order, saveOrder] = useOrder(library === "common" ? "cheats:common" : `cheats:profile:${profile.id}`);
  const [sort, setSort] = useState("custom");
  const filtered = items.filter((c) => !q || `${c.title} ${c.sources.join(" ")} ${c.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase()));
  const shown = applyOrder(filtered, order, sort, "title", "updated_at");
  const close = () => { setOpen(false); if (preselect.length) setSp({}); };

  return (
    <div className="h-full overflow-y-auto bg-[#F8FAFC]" data-testid="cheatsheets-page">
      <div className="mx-auto max-w-7xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <h1 className="ori-title text-3xl sm:text-4xl font-bold tracking-tight text-[#1B2A3A]">Chuletas</h1>
            <p className="text-slate-500 text-sm mt-1">Hojas de consulta rápida generadas a partir de tus documentos, listas para imprimir.</p>
          </div>
          <button data-testid="cheat-create-button" onClick={() => setOpen(true)} className="ml-auto flex items-center gap-2 rounded-full bg-[#1B2A3A] px-5 py-2.5 text-sm text-white hover:bg-[#14202C]"><Plus size={16} />Hacer chuleta</button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={library} onValueChange={setLibrary}><TabsList>
            <TabsTrigger value="common" data-testid="cheat-tab-common">Común</TabsTrigger>
            <TabsTrigger value="mine" data-testid="cheat-tab-mine">Mis chuletas</TabsTrigger>
          </TabsList></Tabs>
          <div className="relative flex-1 min-w-[220px] max-w-md"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input data-testid="cheat-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título, documento o etiqueta"
              className="w-full rounded-full border border-slate-200 bg-white pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3FE0D0]" /></div>
          <SortSelect value={sort} onChange={setSort} testId="cheat-sort-select" />
        </div>
        {shown.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center" data-testid="cheat-empty"><OriHero expression="idea" className="h-48" /><p className="text-sm text-slate-500">Aún no hay chuletas aquí. Crea la primera desde un documento.</p></div>
        ) : (
          <div data-testid="cheat-grid">
            <SortableList items={shown} onReorder={saveOrder} disabled={sort !== "custom"} testPrefix="cheat-sort" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              render={(c, grip) => <CheatCard c={c} grip={grip} onOpen={(x) => navigate(`/chuletas/${x.id}`)} />} />
          </div>
        )}
      </div>
      <NewCheatsheetDialog open={open} onClose={close} preselect={preselect} library={library} onCreated={(id) => navigate(`/chuletas/${id}`)} />
    </div>
  );
}
