import { useEffect, useState } from "react";
import { BookOpen, Download, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Markdown } from "@/components/common/Markdown";
import { API, getToken } from "@/lib/api";

export const DOCS = [
  { slug: "manual", label: "Manual de uso" },
  { slug: "guia-casa", label: "Guía: PC de casa" },
  { slug: "guia-centro", label: "Guía: PC del centro" },
  { slug: "problemas", label: "Problemas frecuentes" },
];

export default function HelpPage() {
  const [slug, setSlug] = useState("manual");
  const [text, setText] = useState(null);
  useEffect(() => {
    setText(null);
    fetch(`/docs/${slug}.md`).then((r) => r.text()).then(setText).catch(() => setText("No se pudo cargar este documento."));
  }, [slug]);
  return (
    <div className="h-full overflow-y-auto bg-[#F8FAFC]" data-testid="help-page">
      <div className="mx-auto max-w-5xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <h1 className="ori-title flex items-center gap-3 text-3xl sm:text-4xl font-bold tracking-tight text-[#1B2A3A]"><BookOpen className="text-[#16B8A7]" />Ayuda</h1>
            <p className="text-slate-500 text-sm mt-1">Manual de Ori y guías paso a paso para instalarlo en casa y en el centro.</p>
          </div>
          <a data-testid="help-pdf-download" href={`${API}/downloads/${slug}.pdf?token=${encodeURIComponent(getToken() || "")}`}
            className="ml-auto flex items-center gap-2 rounded-full bg-[#1B2A3A] px-5 py-2.5 text-sm text-white hover:bg-[#14202C]"><Download size={15} />Descargar en PDF</a>
        </div>
        <Tabs value={slug} onValueChange={setSlug}>
          <TabsList className="flex-wrap h-auto">{DOCS.map((d) => <TabsTrigger key={d.slug} value={d.slug} data-testid={`help-tab-${d.slug}`}>{d.label}</TabsTrigger>)}</TabsList>
        </Tabs>
        <article className="ori-doc rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 shadow-sm text-sm text-slate-700" data-testid="help-content">
          {text === null ? <Loader2 className="animate-spin text-slate-400" /> : <Markdown>{text}</Markdown>}
        </article>
      </div>
    </div>
  );
}
