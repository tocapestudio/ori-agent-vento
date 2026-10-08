import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, MonitorDown, FileText, Loader2 } from "lucide-react";
import { api, API, getToken } from "@/lib/api";

const INFO = {
  "OriParche.exe": { title: "Parche de Ori (si ya lo instalaste)", desc: "Actualiza tu Ori instalado sin descargar el instalador completo: corrige el arranque, los documentos atascados en «Procesando», mejora la búsqueda en tu biblioteca y añade el asistente de investigación. Ejecútalo y pulsa «Abrir Ori». Tus datos no se tocan.", icon: MonitorDown },
  "OriSetup.exe": { title: "Instalador de Ori para Windows 10/11", desc: "Todo incluido (no hace falta instalar nada más). Crea el acceso directo «Ori» en el escritorio.", icon: MonitorDown },
  "manual.pdf": { title: "Manual de uso", desc: "Todas las funciones de Ori explicadas con capturas." },
  "guia-casa.pdf": { title: "Guía: PC de casa", desc: "Instalar, primer arranque, clave de Gemini y copias de seguridad." },
  "guia-centro.pdf": { title: "Guía: PC del centro", desc: "Importar tu copia, abrir Ori al equipo por la red y conectarte desde casa con Tailscale." },
  "problemas.pdf": { title: "Problemas frecuentes", desc: "Qué hacer si Ori no abre, el puerto está ocupado, el firewall o el límite de Gemini." },
};
const fmt = (b) => (b > 1e9 ? `${(b / 1e9).toFixed(2)} GB` : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

export default function DownloadsPage() {
  const [files, setFiles] = useState(null);
  useEffect(() => { api.get("/downloads").then((r) => setFiles(r.data)).catch(() => setFiles([])); }, []);
  const rank = (n) => (n === "OriParche.exe" ? 2 : n === "OriSetup.exe" ? 1 : 0);
  const sorted = (files || []).slice().sort((a, b) => rank(b.name) - rank(a.name));
  return (
    <div className="h-full overflow-y-auto bg-[#F8FAFC]" data-testid="downloads-page">
      <div className="mx-auto max-w-4xl p-6 sm:p-8 space-y-6">
        <div>
          <h1 className="ori-title text-3xl sm:text-4xl font-bold tracking-tight text-[#1B2A3A]">Descargas</h1>
          <p className="text-slate-500 text-sm mt-1">Instalador para Windows, manual y guías en PDF. También puedes leerlos en <Link to="/ayuda" className="text-[#0F7F75] hover:underline" data-testid="downloads-help-link">Ayuda</Link>.</p>
        </div>
        {files === null ? <Loader2 className="animate-spin text-slate-400" /> : sorted.length === 0 ? (
          <p className="text-sm text-slate-500" data-testid="downloads-empty">No hay archivos disponibles en este equipo.</p>
        ) : (
          <div className="space-y-3">
            {sorted.map((f) => {
              const info = INFO[f.name] || { title: f.name, desc: "" };
              const Icon = info.icon || FileText;
              const main = f.name === "OriSetup.exe";
              return (
                <div key={f.name} data-testid={`download-item-${f.name}`} className={`flex items-center gap-4 rounded-2xl border bg-white p-5 shadow-sm ${main ? "border-[#3FE0D0]" : "border-slate-200"}`}>
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${main ? "bg-[#1B2A3A] text-[#3FE0D0]" : "bg-[#E6FAF8] text-[#16B8A7]"}`}><Icon size={22} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#1B2A3A]">{info.title}</p>
                    <p className="text-xs text-slate-500">{info.desc} <span className="text-slate-400">· {f.name} · {fmt(f.size)}</span></p>
                  </div>
                  <a data-testid={`download-link-${f.name}`} href={`${API}/downloads/${encodeURIComponent(f.name)}?token=${encodeURIComponent(getToken() || "")}`}
                    className="flex items-center gap-2 rounded-full bg-[#1B2A3A] px-5 py-2 text-sm text-white hover:bg-[#14202C]"><Download size={15} />Descargar</a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
