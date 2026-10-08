import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Eye, Pencil, MoreHorizontal, Pin, PinOff, Search, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/layout/ConfirmDialog";
import { SortableList, applyOrder, useOrder } from "@/components/common/Sortable";
import { setLastConv } from "@/lib/lastConv";

const fmt = (iso) => {
  const d = new Date(iso);
  const hora = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const hoy = new Date();
  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return `Hoy, ${hora}`;
  if (d.toDateString() === ayer.toDateString()) return `Ayer, ${hora}`;
  const opts = { day: "numeric", month: "short", ...(d.getFullYear() !== hoy.getFullYear() ? { year: "numeric" } : {}) };
  return `${d.toLocaleDateString("es-ES", opts)}, ${hora}`;
};

const ConvItem = ({ c, active, own, pinned, grip, onRename, onDelete, onPin }) => {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(c.title);
  useEffect(() => setTitle(c.title), [c.title]);
  const commit = async () => {
    setEditing(false);
    if (title.trim() && title.trim() !== c.title) await onRename(c, title.trim());
    else setTitle(c.title);
  };
  return (
    <div data-testid={`conversation-item-${c.id}`} onClick={() => !editing && navigate(`/chat/${c.id}`)}
      className={`group flex items-center gap-1.5 rounded-lg px-2.5 py-2.5 cursor-pointer transition-colors ${active ? "bg-[#E6FAF8] text-[#1B2A3A]" : "hover:bg-slate-100 text-slate-700"}`}>
      {grip}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input data-testid={`conversation-rename-input-${c.id}`} autoFocus value={title} maxLength={100}
            onClick={(e) => e.stopPropagation()} onChange={(e) => setTitle(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setTitle(c.title); setEditing(false); } }}
            className="w-full rounded border border-[#3FE0D0] px-1.5 py-0.5 text-sm focus:outline-none" />
        ) : (
          <p className="flex items-center gap-1 text-sm" data-testid={`conversation-title-${c.id}`} title={own ? "Doble clic para renombrar" : c.title}
            onDoubleClick={(e) => { if (own) { e.stopPropagation(); setEditing(true); } }}>
            {pinned && <Pin size={11} className="shrink-0 fill-[#3FE0D0] text-[#16B8A7]" data-testid={`conversation-pinned-${c.id}`} />}<span className="truncate">{c.title}</span>
          </p>
        )}
        <p className="text-[11px] text-slate-400" title={`Creada: ${new Date(c.created_at || c.updated_at).toLocaleString("es-ES")}`}>{fmt(c.updated_at)} · {c.message_count / 2 || 0} preguntas</p>
      </div>
      {own && !editing && (
        <DropdownMenu>
          <DropdownMenuTrigger data-testid={`conversation-menu-${c.id}`} onClick={(e) => e.stopPropagation()} aria-label="Opciones"
            className={`${active ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"} data-[state=open]:opacity-100 h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-slate-500 hover:bg-white hover:text-[#1B2A3A] data-[state=open]:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3FE0D0] transition-opacity`}>
            <MoreHorizontal size={17} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[170px]" onClick={(e) => e.stopPropagation()} onCloseAutoFocus={(e) => e.preventDefault()}>
            <DropdownMenuItem data-testid={`conversation-pin-${c.id}`} className="cursor-pointer px-3 py-2.5" onSelect={() => onPin(c)}>{pinned ? <PinOff size={15} className="mr-2" /> : <Pin size={15} className="mr-2" />}{pinned ? "Desfijar" : "Fijar arriba"}</DropdownMenuItem>
            <DropdownMenuItem data-testid={`conversation-rename-${c.id}`} className="cursor-pointer px-3 py-2.5" onSelect={() => setTimeout(() => setEditing(true), 0)}><Pencil size={15} className="mr-2" />Renombrar</DropdownMenuItem>
            <DropdownMenuItem data-testid={`conversation-delete-${c.id}`} className="cursor-pointer px-3 py-2.5 text-red-600 focus:bg-red-50 focus:text-red-700" onSelect={() => onDelete(c)}><Trash2 size={15} className="mr-2" />Eliminar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

const RailBtn = ({ testId, label, onClick, dark, children }) => (
  <button data-testid={testId} aria-label={label} title={label} onClick={onClick}
    className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${dark ? "bg-[#1B2A3A] text-white hover:bg-[#14202C]" : "text-slate-500 hover:bg-slate-200 hover:text-[#1B2A3A]"}`}>{children}</button>
);

const useSidebarState = (pid) => {
  const small = useMemo(() => window.matchMedia("(max-width: 1023px)").matches, []);
  const key = `ori.sidebar.${pid}`;
  const [collapsed, setCollapsed] = useState(() => small || localStorage.getItem(key) === "1");
  const toggle = useCallback((v) => setCollapsed((c) => {
    const next = typeof v === "boolean" ? v : !c;
    if (!small) localStorage.setItem(key, next ? "1" : "0");
    return next;
  }), [key, small]);
  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") { e.preventDefault(); toggle(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [toggle]);
  return { small, collapsed, toggle };
};

export const ConversationSidebar = ({ activeId, refreshKey, onRenamed }) => {
  const { profile } = useApp();
  const navigate = useNavigate();
  const sb = useSidebarState(profile.id);
  const searchRef = useRef(null);
  const [profiles, setProfiles] = useState([]);
  const [viewing, setViewing] = useState(profile.id);
  const [convs, setConvs] = useState([]);
  const [toDelete, setToDelete] = useState(null);

  useEffect(() => { api.get("/profiles").then((r) => setProfiles(r.data)); }, []);
  const load = useCallback(() => api.get("/conversations", { params: { profile_id: viewing } }).then((r) => setConvs(r.data)), [viewing]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const rename = async (c, title) => {
    try { await api.patch(`/conversations/${c.id}`, { title, profile_id: profile.id }); onRenamed?.(c.id, title); toast.success("Conversación renombrada"); }
    catch (e) { toast.error(errMsg(e)); }
    load();
  };
  const remove = async () => {
    const c = toDelete;
    setToDelete(null);
    try { await api.delete(`/conversations/${c.id}`, { params: { profile_id: profile.id } }); toast.success("Conversación eliminada"); }
    catch (e) { toast.error(errMsg(e)); }
    if (c.id === activeId) { setLastConv(profile.id, null); navigate("/chat", { state: { fresh: true } }); }
    load();
  };
  const own = viewing === profile.id;
  const [order, saveOrder] = useOrder(`convs:${viewing}`);
  const [pins, , setPins] = useOrder(`convpins:${viewing}`);
  const [sort, setSort] = useState("recent");
  const [q, setQ] = useState("");
  const togglePin = (c) => {
    const on = pins.includes(c.id);
    setPins(on ? pins.filter((x) => x !== c.id) : [c.id, ...pins]);
    toast.success(on ? "Conversación desfijada" : "Conversación fijada arriba");
  };
  const filtered = convs.filter((c) => !q.trim() || c.title.toLowerCase().includes(q.trim().toLowerCase()));
  const sorted = applyOrder(filtered, order, sort === "recent" ? "date" : sort, "title", "updated_at");
  const pinned = sorted.filter((c) => pins.includes(c.id));
  const rest = sorted.filter((c) => !pins.includes(c.id));
  const canSort = own && sort === "custom" && !q.trim();
  const list = (items, testId) => (
    <SortableList items={items} onReorder={saveOrder} disabled={!canSort} testPrefix="conversation-sort" className="space-y-0.5"
      render={(c, grip) => <ConvItem c={c} grip={grip} active={c.id === activeId} own={own} pinned={pins.includes(c.id)} onRename={rename} onDelete={setToDelete} onPin={togglePin} />} />
  );

  const newConv = () => { setViewing(profile.id); setLastConv(profile.id, null); navigate("/chat", { state: { fresh: true } }); if (sb.small) sb.toggle(true); };
  const W = { width: sb.collapsed ? 56 : 288 };

  return (
    <div className="relative h-full shrink-0 transition-[width] [transition-duration:250ms] ease-out motion-reduce:transition-none" style={{ width: sb.small || sb.collapsed ? 56 : 288 }} data-testid="conversation-sidebar-wrap">
      {sb.small && !sb.collapsed && <div className="fixed inset-0 z-30 bg-slate-900/20" onClick={() => sb.toggle(true)} data-testid="sidebar-backdrop" />}
      <aside data-testid="conversation-sidebar" data-collapsed={sb.collapsed} style={W}
        className={`absolute inset-y-0 left-0 z-40 flex flex-col overflow-hidden border-r border-slate-200 bg-[#F8FAFC] transition-[width] [transition-duration:250ms] ease-out motion-reduce:transition-none ${sb.small && !sb.collapsed ? "shadow-xl" : ""}`}>
        {sb.collapsed ? (
          <div className="flex flex-col items-center gap-2 py-4" data-testid="sidebar-rail">
            <RailBtn testId="sidebar-expand-button" label="Mostrar conversaciones (Ctrl+B)" onClick={() => sb.toggle(false)}><PanelLeftOpen size={18} /></RailBtn>
            <RailBtn testId="sidebar-rail-new" label="Nueva conversación" onClick={newConv} dark><Plus size={18} /></RailBtn>
            <RailBtn testId="sidebar-rail-search" label="Buscar conversaciones" onClick={() => { sb.toggle(false); setTimeout(() => searchRef.current?.focus(), 280); }}><Search size={17} /></RailBtn>
          </div>
        ) : (
      <div className="flex h-full w-72 flex-col">
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <button data-testid="sidebar-collapse-button" aria-label="Ocultar conversaciones (Ctrl+B)" title="Ocultar conversaciones (Ctrl+B)" onClick={() => sb.toggle(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 hover:text-[#1B2A3A] transition-colors"><PanelLeftClose size={18} /></button>
          <button data-testid="new-conversation-button" onClick={newConv}
            className="flex-1 flex items-center justify-center gap-2 rounded-full bg-[#1B2A3A] text-white py-2.5 text-sm hover:bg-[#14202C] transition-colors">
            <Plus size={16} /> Nueva conversación
          </button>
        </div>
        <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Ver conversaciones de</label>
        <select data-testid="conversation-profile-select" value={viewing} onChange={(e) => setViewing(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3FE0D0]">
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.id === profile.id ? `${p.name} (yo)` : p.name}</option>)}
        </select>
        {!own && <p className="flex items-center gap-1.5 text-xs text-slate-500" data-testid="readonly-hint"><Eye size={12} />Solo lectura</p>}
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input ref={searchRef} data-testid="conversation-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar"
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3FE0D0]" />
          </div>
          <select data-testid="conversation-sort-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar conversaciones"
            className="w-[118px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#3FE0D0]">
            <option value="recent">Recientes</option><option value="custom">Orden personalizado</option><option value="name">Nombre</option>
          </select>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5" data-testid="conversation-list">
        {convs.length === 0 && <p className="px-3 text-sm text-slate-400" data-testid="conversation-list-empty">Sin conversaciones todavía.</p>}
        {convs.length > 0 && filtered.length === 0 && <p className="px-3 text-sm text-slate-400" data-testid="conversation-search-empty">Ninguna conversación coincide.</p>}
        {pinned.length > 0 && (
          <div data-testid="conversation-pinned-group" className="mb-2 border-b border-slate-200 pb-2">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Fijadas</p>
            {list(pinned)}
          </div>
        )}
        {list(rest)}
      </div>
      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} onConfirm={remove} testId="conversation-delete-confirm"
        title={`¿Eliminar "${toDelete?.title}"?`} description="Se borrarán sus mensajes y favoritos. Esta acción no se puede deshacer." />
      </div>
        )}
      </aside>
    </div>
  );
};
