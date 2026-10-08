import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { api, streamChat } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { useChatExtras } from "@/components/chat/useChatExtras";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { Composer } from "@/components/chat/Composer";
import { DocSidePanel } from "@/components/docs/DocSidePanel";
import { OriHero } from "@/components/ori/OriAvatar";

const EmptyState = ({ name }) => (
  <div className="flex flex-col items-center justify-center text-center py-2 ori-fade" data-testid="chat-empty-state">
    <OriHero expression="happy" className="h-[22vh] min-h-[90px] ori-float" testId="chat-empty-ori" />
    <h1 className="ori-title mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-[#1B2A3A]">Hola, {name}</h1>
    <p className="text-slate-500 mt-1 max-w-md text-sm">Pregúntame sobre tus documentos o usa una acción rápida. Siempre cito la fuente y te digo si no lo encuentro.</p>
  </div>
);

export default function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { profile } = useApp();
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [scope, setScope] = useState("both");
  const [web, setWeb] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchParams] = useSearchParams();
  const focusMsg = searchParams.get("m");
  const ex = useChatExtras(conversationId, searchParams.get("tpl"));
  const skipLoad = useRef(null);
  const newConvId = useRef(null);
  const bottom = useRef(null);

  useEffect(() => {
    if (!conversationId) { setConv(null); setMessages([]); return; }
    if (skipLoad.current === conversationId) return;
    api.get(`/conversations/${conversationId}`).then(({ data }) => { setConv(data.conversation); setMessages(data.messages); })
      .catch(() => { toast.error("Conversación no encontrada"); navigate("/chat"); });
  }, [conversationId, navigate]);

  useEffect(() => {
    const el = focusMsg && !busy && document.querySelector(`[data-message-id="${focusMsg}"]`);
    if (el) {
      el.scrollIntoView({ block: "center" });
      el.classList.add("ori-highlight");
      return;
    }
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, focusMsg, busy]);

  const patchLast = (fn) => setMessages((m) => [...m.slice(0, -1), fn(m[m.length - 1])]);

  const send = async (retryQuestion) => {
    const tpl = typeof retryQuestion === "string" ? null : ex.template;
    const question = (typeof retryQuestion === "string" ? retryQuestion : input).trim()
      || (tpl ? `Rellena la plantilla "${tpl.name}" con la información de esta conversación.` : "");
    if (typeof retryQuestion !== "string") setInput("");
    ex.setTemplate(null);
    setBusy(true);
    setMessages((m) => [...(typeof retryQuestion === "string" ? m.slice(0, -2) : m), { role: "user", content: question, template_name: tpl?.name }, { role: "assistant", content: "", streaming: true }]);
    try {
      await streamChat({ question, scope, web_search: web, profile_id: profile.id, conversation_id: conversationId || null, template_id: tpl?.id || null }, (ev) => {
        if (ev.type === "meta" && !conversationId) {
          newConvId.current = ev.conversation_id;
          skipLoad.current = ev.conversation_id;
          setConv({ id: ev.conversation_id, profile_id: profile.id, title: question.slice(0, 70) });
          navigate(`/chat/${ev.conversation_id}`, { replace: true });
        } else if (ev.type === "status") patchLast((x) => ({ ...x, status: ev.message }));
        else if (ev.type === "delta") patchLast((x) => ({ ...x, content: x.content + ev.text }));
        else if (ev.type === "done") patchLast(() => ({ role: "assistant", id: ev.message_id, content: ev.answer, doc_sources: ev.doc_sources, web_sources: ev.web_sources, disclaimer: ev.disclaimer }));
        else if (ev.type === "error") {
          patchLast(() => ({ role: "assistant", content: ev.message, error: true }));
          toast.error(ev.message);
        }
      });
    } catch (e) {
      patchLast(() => ({ role: "assistant", content: e.message, error: true }));
    } finally {
      setBusy(false);
      setRefreshKey((k) => k + 1);
      if (newConvId.current) {
        const cid = newConvId.current;
        newConvId.current = null;
        setTimeout(() => api.get(`/conversations/${cid}`).then(({ data }) => {
          setConv((c) => (c?.id === cid ? data.conversation : c));
          setRefreshKey((k) => k + 1);
        }).catch(() => {}), 6000);
      }
    }
  };

  const readOnly = !!conv && conv.profile_id !== profile.id;
  const lastAssistant = messages.map((m) => m.role).lastIndexOf("assistant");

  return (
    <div className="flex h-full" data-testid="chat-page">
      <ConversationSidebar activeId={conversationId} refreshKey={refreshKey} onRenamed={(cid, t) => setConv((c) => (c?.id === cid ? { ...c, title: t } : c))} />
      <section className="flex-1 min-w-0 flex flex-col">
        {conv && (
          <div className="border-b border-slate-200 px-6 py-3 flex items-center gap-2">
            <h2 className="ori-title text-base md:text-lg text-[#1B2A3A] truncate" data-testid="conversation-title">{conv.title}</h2>
            {readOnly && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500" data-testid="readonly-badge">Solo lectura</span>}
            {conversationId && (
              <button data-testid="conversation-star-button" data-starred={ex.isFav(null)} onClick={() => ex.toggleFav(null)}
                className={`ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${ex.isFav(null) ? "border-amber-300 bg-amber-50 text-amber-600" : "border-slate-200 text-slate-500 hover:text-[#1B2A3A]"}`}>
                <Star size={13} className={ex.isFav(null) ? "fill-amber-400" : ""} />{ex.isFav(null) ? "En favoritos" : "Añadir a favoritos"}
              </button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-6" data-testid="chat-messages">
          <div className={`mx-auto max-w-[1200px] ${messages.length === 0 ? "flex h-full flex-col justify-center" : "space-y-6"}`}>
            {messages.length === 0 ? <EmptyState name={profile.name} /> : messages.map((m, i) => (
              <MessageBubble key={i} msg={m} idx={i} isLast={i === lastAssistant} onOpen={setPreview}
                onRetry={!busy && !readOnly ? () => send(messages[i - 1]?.content || "") : null}
                starred={ex.isFav(m.id)} onStar={conversationId ? ex.toggleFav : null} />
            ))}
            <div ref={bottom} />
          </div>
        </div>
        <div className="mx-auto w-full max-w-[1200px]">
          <Composer value={input} setValue={setInput} scope={scope} setScope={setScope} web={web} setWeb={setWeb}
            onSend={send} busy={busy} readOnly={readOnly} templates={ex.templates} template={ex.template} setTemplate={ex.setTemplate} hasMessages={messages.length > 0 || !!conversationId} viewKey={conversationId || "new"} />
        </div>
      </section>
      {preview && <DocSidePanel target={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
