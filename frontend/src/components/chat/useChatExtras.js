import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useApp } from "@/context/AppContext";

export const useChatExtras = (conversationId, tplId) => {
  const { profile } = useApp();
  const [templates, setTemplates] = useState([]);
  const [template, setTemplate] = useState(null);
  const [favs, setFavs] = useState([]);

  useEffect(() => {
    api.get("/templates", { params: { profile_id: profile.id } }).then(({ data }) => {
      setTemplates(data);
      if (tplId) setTemplate(data.find((t) => t.id === tplId) || null);
    });
  }, [profile.id, tplId]);

  const loadFavs = useCallback(() => {
    if (!conversationId) return setFavs([]);
    api.get("/favorites", { params: { conversation_id: conversationId } }).then((r) => setFavs(r.data));
  }, [conversationId]);
  useEffect(() => { loadFavs(); }, [loadFavs]);

  const mine = (mid) => favs.find((f) => f.saved_by === profile.id && (f.message_id || null) === (mid || null));
  const toggleFav = async (mid = null) => {
    const existing = mine(mid);
    try {
      if (existing) await api.delete(`/favorites/${existing.id}`, { params: { profile_id: profile.id } });
      else await api.post("/favorites", { conversation_id: conversationId, message_id: mid, profile_id: profile.id });
      toast.success(existing ? "Quitado de favoritos" : "Añadido a favoritos del equipo");
      loadFavs();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return { templates, template, setTemplate, isFav: (mid) => !!mine(mid), toggleFav };
};
