import { useState } from "react";
import { KeyRound, Sparkles, ArrowRight, Upload, Loader2, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { OriHero } from "@/components/ori/OriAvatar";

const field = "w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3FE0D0]";
const primary = "flex items-center gap-2 rounded-full bg-[#1B2A3A] px-6 py-2.5 text-sm text-white hover:bg-[#14202C] disabled:opacity-50";

const Steps = ({ step }) => (
  <div className="flex gap-2" data-testid="setup-steps">
    {["Código del equipo", "Clave de Gemini", "Copia de seguridad"].map((s, i) => (
      <span key={s} className={`rounded-full px-3 py-1 text-xs ${i === step ? "bg-[#1B2A3A] text-white" : i < step ? "bg-[#E6FAF8] text-[#0F7F75]" : "bg-slate-100 text-slate-400"}`}>{i + 1}. {s}</span>
    ))}
  </div>
);

export default function SetupWizard({ onDone }) {
  const { setToken } = useApp();
  const [step, setStep] = useState(0);
  const [code, setCode] = useState("Orion9944+");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [pct, setPct] = useState(null);

  const complete = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/setup/complete", { access_code: code, gemini_api_key: key.trim() || null });
      setToken(data.token);
      setStep(2);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const importBackup = async () => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("mode", "replace");
    setPct(0);
    try {
      await api.post("/backup/import", fd, { onUploadProgress: (e) => setPct(e.total ? Math.round((e.loaded * 100) / e.total) : 0) });
      toast.success("Copia importada. Entra con el código de acceso de tu copia.");
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) { toast.error(errMsg(e)); setPct(null); }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-6 py-10" data-testid="setup-wizard">
      <OriHero expression="waving" className="h-44" testId="setup-ori" />
      <h1 className="ori-title mt-2 text-4xl sm:text-5xl font-bold tracking-tight text-[#1B2A3A]">¡Bienvenida a Ori!</h1>
      <p className="mt-2 mb-6 text-slate-500 text-sm">Vamos a dejarlo listo en tres pasos. Podrás cambiar todo después en Ajustes.</p>
      <Steps step={step} />
      <div className="mt-6 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        {step === 0 && (
          <>
            <h2 className="flex items-center gap-2 font-semibold text-[#1B2A3A]"><KeyRound size={18} className="text-[#16B8A7]" />Código de acceso del equipo</h2>
            <p className="text-sm text-slate-500">Es la contraseña común que usará todo el equipo para entrar en Ori. Mínimo 6 caracteres.</p>
            <input data-testid="setup-code-input" value={code} onChange={(e) => setCode(e.target.value)} className={field} />
            <button data-testid="setup-next-1" disabled={code.trim().length < 6} onClick={() => setStep(1)} className={primary}>Siguiente<ArrowRight size={15} /></button>
          </>
        )}
        {step === 1 && (
          <>
            <h2 className="flex items-center gap-2 font-semibold text-[#1B2A3A]"><Sparkles size={18} className="text-[#16B8A7]" />Tu clave gratuita de Gemini</h2>
            <p className="text-sm text-slate-500">Ori usa la IA de Google con tu propia clave gratuita. Créala en Google AI Studio (botón «Create API key»), cópiala y pégala aquí.</p>
            <a data-testid="setup-gemini-link" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-[#0F7F75] hover:underline"><ExternalLink size={14} />aistudio.google.com/apikey</a>
            <input data-testid="setup-gemini-input" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Pega aquí tu clave (empieza por AIza…)" className={field} />
            <div className="flex items-center gap-3">
              <button data-testid="setup-finish" disabled={busy} onClick={complete} className={primary}>{busy && <Loader2 size={15} className="animate-spin" />}{key.trim() ? "Guardar y continuar" : "Lo haré más tarde"}<ArrowRight size={15} /></button>
              <button data-testid="setup-back" onClick={() => setStep(0)} className="text-sm text-slate-500 hover:text-[#1B2A3A]">Atrás</button>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h2 className="flex items-center gap-2 font-semibold text-[#1B2A3A]"><CheckCircle2 size={18} className="text-emerald-600" />¡Listo! ¿Tienes una copia de seguridad?</h2>
            <p className="text-sm text-slate-500">Si vienes de otro PC (por ejemplo, del de casa), importa aquí tu copia (.zip) y tendrás todos tus documentos, chuletas y conversaciones. Después entrarás con el código de acceso que tenías en esa copia.</p>
            <input data-testid="setup-backup-file" type="file" accept=".zip" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-4 file:py-1.5" />
            {pct !== null && <p className="text-sm text-slate-500" data-testid="setup-import-progress">{pct < 100 ? `Subiendo copia… ${pct}%` : "Restaurando datos…"}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <button data-testid="setup-import-button" disabled={!file || pct !== null} onClick={importBackup} className={primary}><Upload size={15} />Importar copia</button>
              <button data-testid="setup-start-button" onClick={onDone} className="rounded-full border border-slate-200 px-5 py-2.5 text-sm hover:border-[#3FE0D0]">Empezar sin copia</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
