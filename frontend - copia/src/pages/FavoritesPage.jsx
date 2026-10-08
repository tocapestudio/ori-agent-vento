import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Star, MessagesSquare, MessageSquareQuote, X } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { ProfileAvatar } from "@/components/layout/ProfileAvatar";
import { OriHero } from "@/components/ori/OriAvatar";
import { SortableList, SortSelect, applyOrder, useOrder } from "@/components/common/Sortable";

const fmtDate = (iso) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

const FavCard = ({ f, mine, onOpen, onRemove, grip }) => (
  <div data-testid={`favorite-card-${f.id}`} onClick={() => onOpen(f)}
    className="group h-full cursor-pointer rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3 ori-fade">
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-slate-400">
      {grip}
      {f.kind === "message" ? <><MessageSquareQuote size={13} className="text-[#16B8A7]" />Respuesta</> : <><MessagesSquare size={13} className="text-[#16B8A7]" />Conversación</>}
      {mine && (
        <button aria-label="Quitar de favoritos" data-testid={`favorite-remove-${f.id}`} onClick={(e) => { e.stopPropagation(); onRemove(f); }}
          className="ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 normal-case tracking-normal text-slate-400 hover:bg-slate-100 hover:text-red-600"><X size={12} />Quitar</button>
      )}
    </div>
    <h3 className="ori-title font-semibold text-[#1B2A3A] line-clamp-2" data-testid={`favorite-title-${f.id}`}>{f.title}</h3>
    {f.snippet && <p className="text-xs text-slate-500 line-clamp-3">{f.snippet}</p>}
    <div className="mt-auto flex items-center gap-2 text-xs text-slate-500" data-testid={`favorite-saved-by-${f.id}`}>
      <ProfileAvatar profile={{ name: f.saved_by_name, color: f.saved_by_color }} size={22} />
      Guardado por <b className="text-[#1B2A3A]">{f.saved_by_name}</b> · {fmtDate(f.created_at)}
    </div>
  </div>
);

export default function FavoritesPage() {
  const { profile } = useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");

  const load = useCallback(() => api.get("/favorites", { params: q ? { q } : {} }).then((r) => setItems(r.data)), [q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const remove = async (f) => {
    try { await api.delete(`/favorites/${f.id}`, { params: { profile_id: profile.id } }); toast.success("Quitado de favoritos"); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const [order, saveOrder] = useOrder("favorites:shared");
  const [sort, setSort] = useState("custom");
  const shown = applyOrder(items, order, sort, "title", "created_at");
  const open = (f) => navigate(`/chat/${f.conversation_id}${f.message_id ? `?m=${f.message_id}` : ""}`);

  return (
    <div className="h-full overflow-y-auto bg-[#F8FAFC]" data-testid="favorites-page">
      <div className="mx-auto max-w-7xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <span className="h-11 w-11 rounded-xl bg-[#1B2A3A] text-[#3FE0D0] flex items-center justify-center"><Star size={20} /></span>
          <div>
            <h1 className="ori-title text-3xl sm:text-4xl font-bold tracking-tight text-[#1B2A3A]">Favoritos del equipo</h1>
            <p className="text-slate-500 text-sm">Conversaciones y respuestas destacadas por cualquier perfil.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input data-testid="favorites-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título, contenido o perfil"
              className="w-full rounded-full border border-slate-200 bg-white pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3FE0D0]" />
          </div>
          <SortSelect value={sort} onChange={setSort} testId="favorites-sort-select" />
        </div>
        {items.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center" data-testid="favorites-empty">
            <OriHero expression="wink" className="h-48" />
            <p className="text-sm text-slate-500">{q ? "Ningún favorito coincide." : "Aún no hay favoritos. Marca la estrella en una conversación o respuesta."}</p>
          </div>
        ) : (
          <div data-testid="favorites-grid">
            <SortableList items={shown} onReorder={saveOrder} disabled={sort !== "custom"} testPrefix="favorite-sort" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              render={(f, grip) => <FavCard f={f} grip={grip} mine={f.saved_by === profile.id} onOpen={open} onRemove={remove} />} />
          </div>
        )}
      </div>
    </div>
  );
}
