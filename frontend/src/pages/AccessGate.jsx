import { useState } from "react";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { OriHero } from "@/components/ori/OriAvatar";

export default function AccessGate() {
  const { setToken } = useApp();
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/auth/access", { code });
      setToken(data.token);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white" data-testid="access-gate">
      <div className="hidden lg:flex flex-col justify-between bg-[#F4FBFA] p-14 relative overflow-hidden">
        <div className="flex items-center gap-2 ori-title text-2xl font-bold text-[#1B2A3A]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#3FE0D0]" /> Ori
        </div>
        <OriHero expression="waving" className="h-[min(62vh,560px)] self-center ori-float" testId="access-ori-waving" />
        <p className="text-slate-500 text-sm max-w-sm">Asistente de optometría clínica, terapia visual, entrenamiento visual deportivo, contactología y audiología.</p>
      </div>
      <div className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-6 ori-fade" data-testid="access-form">
          <OriHero expression="waving" className="h-56 mx-auto lg:hidden" />
          <div className="space-y-2">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#1B2A3A] text-[#3FE0D0]"><Lock size={20} /></span>
            <h1 className="ori-title text-3xl sm:text-4xl font-bold tracking-tight text-[#1B2A3A]">Bienvenido a Ori</h1>
            <p className="text-slate-500 text-sm">Introduce el código de acceso del equipo para continuar.</p>
          </div>
          <div className="relative">
            <input
              data-testid="access-code-input" type={show ? "text" : "password"} value={code} autoFocus
              onChange={(e) => setCode(e.target.value)} placeholder="Código de acceso"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-11 text-base focus:outline-none focus:ring-2 focus:ring-[#3FE0D0]"
            />
            <button type="button" data-testid="access-code-toggle" aria-label="Mostrar código" onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#1B2A3A]">
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {error && <p data-testid="access-error" className="text-sm text-red-600">{error}</p>}
          <button data-testid="access-submit-button" disabled={busy || !code}
            className="w-full rounded-xl bg-[#1B2A3A] py-3 text-white font-medium hover:bg-[#14202C] disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {busy && <Loader2 size={16} className="animate-spin" />} Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
