import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { FileText, Globe, ExternalLink, AlertTriangle, Loader2, RotateCw, Copy, Check, Star, FileStack } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { OriAvatar } from "@/components/ori/OriAvatar";

const DISC_RE = /(?:^|\n)[ \t>*_-]*([^\n]*(?:herramienta de apoyo|juicio cl[ií]nico)[^\n]*)\s*$/i;
const splitDisclaimer = (content) => {
  const m = DISC_RE.exec(content.trimEnd());
  return m ? [content.slice(0, m.index).trimEnd(), m[1].replace(/^[\s*_]+|[\s*_]+$/g, "")] : [content, null];
};

const pageOf = (s) => { const m = /p(?:ág(?:ina)?)?\.?\s*(\d+)/i.exec(s); return m ? Number(m[1]) : null; };

const resolvePart = (part, sources, files, refs) => {
  const low = part.toLowerCase();
  const file = files.find((f) => low.includes(f.toLowerCase()));
  if (!file) return null;
  const rest = part.slice(low.indexOf(file.toLowerCase()) + file.length).replace(/^[\s,·:;-]+/, "").trim();
  let i = refs.findIndex((s) => s.file_name === file && (!rest || s.ref.toLowerCase() === rest.toLowerCase()));
  if (i < 0) {
    const base = sources.find((s) => s.file_name === file);
    refs.push({ ...base, ref: rest, page: pageOf(rest) ?? base.page, cite: part, snippet: null });
    i = refs.length - 1;
  }
  return `[${file} · ${refs[i].ref}](#cite-${i})`;
};

const linkify = (content, sources = [], web = []) => {
  const refs = [...sources];
  const files = [...new Set(sources.map((s) => s.file_name))].sort((a, b) => b.length - a.length);
  let out = content.replace(/\[([^[\]]{3,300})\](?!\()/g, (m, group) => {
    const exact = sources.findIndex((s) => s.cite === group);
    if (exact >= 0) return `[${sources[exact].file_name} · ${sources[exact].ref}](#cite-${exact})`;
    const parts = group.split(/\s*;\s*/).map((p) => ({ p, link: resolvePart(p, sources, files, refs) }));
    if (!parts.some((x) => x.link)) return m;
    return parts.map((x) => x.link || `[${x.p}]`).join(" ");
  });
  const byLabel = Object.fromEntries(web.map((w, i) => [w.label, i]));
  out = out.replace(/\[(W\d+(?:\s*[,;]\s*W\d+)*)\](?!\()/g, (m, g) =>
    g.split(/\s*[,;]\s*/).map((l) => (l in byLabel ? `[${l}](#web-${byLabel[l]})` : `[${l}]`)).join(" "));
  return { text: out, refs };
};

const WebChip = ({ source, testId }) => (
  <a href={source.url} target="_blank" rel="noreferrer" data-testid={testId} title={source.url}
    className="mx-0.5 inline-flex max-w-[260px] items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 align-baseline text-xs font-medium text-[#1B2A3A] ring-1 ring-slate-300 hover:bg-[#3FE0D0]/30 no-underline transition-colors">
    <Globe size={11} className="shrink-0" /><span className="truncate">{source.title}</span>
  </a>
);

const CitationChip = ({ source, onOpen, testId }) => (
  <button data-testid={testId} onClick={() => onOpen(source)}
    className="mx-0.5 inline-flex items-center gap-1 rounded-full bg-[#E6FAF8] px-2 py-0.5 align-baseline text-xs font-medium text-[#0F7F75] ring-1 ring-[#3FE0D0]/40 hover:bg-[#3FE0D0]/30 transition-colors">
    <FileText size={11} />{source.file_name} · {source.ref}
  </button>
);

const uniqueSources = (list = []) => {
  const seen = new Set();
  return list.filter((s) => { const k = `${s.doc_id}|${s.ref}`; if (seen.has(k)) return false; seen.add(k); return true; });
};

const Sources = ({ msg, idx, onOpen }) => (
  <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
    {msg.doc_sources?.length > 0 && (
      <div data-testid={`msg-doc-sources-${idx}`}>
        <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-1.5">Fuentes de tus documentos</p>
        <div className="flex flex-wrap gap-1.5">
          {uniqueSources(msg.doc_sources).map((s, k) => <CitationChip key={k} source={s} onOpen={onOpen} testId={`source-chip-${idx}-${k}`} />)}
        </div>
      </div>
    )}
    {msg.web_sources?.length > 0 && (
      <div data-testid={`msg-web-sources-${idx}`} className="rounded-lg border-l-2 border-[#3FE0D0] bg-slate-50 px-3 py-2">
        <p className="flex items-center gap-1 text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-1"><Globe size={11} />Fuente web</p>
        {msg.web_sources.map((s, k) => (
          <a key={k} href={s.url} target="_blank" rel="noreferrer" data-testid={`web-source-link-${idx}-${k}`}
            className="flex items-center gap-1 text-xs text-[#0F7F75] hover:underline truncate"><ExternalLink size={11} className="shrink-0" />{s.title}</a>
        ))}
      </div>
    )}
  </div>
);

const AnswerActions = ({ msg, idx, starred, onStar }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (await copyText(msg.content)) { setCopied(true); setTimeout(() => setCopied(false), 1500); toast.success("Respuesta copiada"); }
    else toast.error("No se pudo copiar");
  };
  return (
    <div className="mt-3 flex items-center gap-1" data-testid={`msg-actions-${idx}`}>
      <button data-testid={`msg-copy-${idx}`} onClick={copy} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-[#1B2A3A]">
        {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}{copied ? "Copiado" : "Copiar"}
      </button>
      {msg.id && onStar && (
        <button data-testid={`msg-star-${idx}`} data-starred={starred} onClick={() => onStar(msg.id)}
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs hover:bg-slate-100 ${starred ? "text-amber-500" : "text-slate-500 hover:text-[#1B2A3A]"}`}>
          <Star size={13} className={starred ? "fill-amber-400" : ""} />{starred ? "En favoritos" : "Favorito"}
        </button>
      )}
    </div>
  );
};

const AssistantBody = ({ msg, idx, onOpen, onRetry, starred, onStar }) => {
  if (msg.error) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-amber-700" data-testid={`msg-error-${idx}`}>
        <AlertTriangle size={16} /><span className="flex-1">{msg.content}</span>
        {onRetry && <button data-testid="chat-retry-button" onClick={onRetry} className="flex items-center gap-1 rounded-full border border-amber-300 px-3 py-1 text-xs hover:bg-amber-50"><RotateCw size={12} />Reintentar</button>}
      </div>
    );
  }
  if (msg.streaming && !msg.content) {
    return <p className="flex items-center gap-2 text-slate-500" data-testid="chat-thinking"><Loader2 size={14} className="animate-spin" />{msg.status || "Ori está pensando…"}</p>;
  }
  const [body, disclaimer] = msg.disclaimer ? [msg.content, msg.disclaimer] : splitDisclaimer(msg.content);
  const { text, refs } = linkify(body, msg.doc_sources, msg.web_sources);
  const components = {
    a: ({ href, children }) => {
      if (href?.startsWith("#cite-")) {
        const s = refs[Number(href.slice(6))];
        return s ? <CitationChip source={s} onOpen={onOpen} testId={`inline-cite-${idx}-${href.slice(6)}`} /> : <>{children}</>;
      }
      if (href?.startsWith("#web-")) {
        const w = msg.web_sources?.[Number(href.slice(5))];
        return w ? <WebChip source={w} testId={`inline-web-cite-${idx}-${href.slice(5)}`} /> : <>{children}</>;
      }
      return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
    },
  };
  return (
    <>
      <div className="ori-md"><ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{text}</ReactMarkdown></div>
      {msg.streaming && <span className="ori-caret" />}
      {disclaimer && <p className="ori-disclaimer" data-testid={`msg-disclaimer-${idx}`}>{disclaimer}</p>}
      {!msg.streaming && <Sources msg={msg} idx={idx} onOpen={onOpen} />}
      {!msg.streaming && <AnswerActions msg={msg} idx={idx} starred={starred} onStar={onStar} />}
    </>
  );
};

const UserCopy = ({ text, idx }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (await copyText(text)) { setCopied(true); setTimeout(() => setCopied(false), 1500); toast.success("Mensaje copiado"); }
    else toast.error("No se pudo copiar");
  };
  return (
    <button data-testid={`user-msg-copy-${idx}`} onClick={copy} aria-label="Copiar mensaje" title="Copiar mensaje"
      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-slate-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 hover:bg-slate-100 hover:text-[#1B2A3A] transition-opacity">
      {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}{copied ? "Copiado" : "Copiar"}
    </button>
  );
};

export const MessageBubble = ({ msg, idx, isLast, onOpen, onRetry, starred, onStar }) => {
  if (msg.role === "user") {
    return (
      <div className="group flex flex-col items-end gap-1 ori-fade" data-testid={`chat-message-${idx}`} data-message-id={msg.id}>
        {msg.template_name && <span className="flex items-center gap-1 text-[11px] text-[#0F7F75]" data-testid={`msg-template-${idx}`}><FileStack size={11} />Plantilla: {msg.template_name}</span>}
        <div className="max-w-[75%] rounded-2xl rounded-br-md bg-[#1B2A3A] px-4 py-3 text-sm text-white whitespace-pre-wrap">{msg.content}</div>
        <UserCopy text={msg.content} idx={idx} />
      </div>
    );
  }
  const expression = msg.streaming ? "thinking" : msg.error ? "neutral" : isLast ? "idea" : "neutral";
  return (
    <div className="flex gap-3 ori-fade rounded-2xl transition-colors" data-testid={`chat-message-${idx}`} data-message-id={msg.id}>
      <OriAvatar expression={expression} size={40} testId={`msg-ori-avatar-${idx}`} className={msg.streaming ? "ori-pulse" : ""} />
      <div className="ori-answer min-w-0 flex-1 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700 shadow-sm">
        <AssistantBody msg={msg} idx={idx} onOpen={onOpen} onRetry={isLast ? onRetry : null} starred={starred} onStar={onStar} />
      </div>
    </div>
  );
};
