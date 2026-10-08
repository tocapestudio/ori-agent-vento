import { useCallback, useEffect, useState } from "react";
import { Loader2, Cpu, KeyRound, PlugZap, CheckCircle2, AlertTriangle, DatabaseBackup, Download, Upload, Wifi, BookOpen, Power, History, Library, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg, API, getToken } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/context/AppContext";
import { OriHero } from "@/components/ori/OriAvatar";
import { ConfirmDialog } from "@/components/layout/ConfirmDialog";

const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3FE0D0]";
const GEMINI_MODELS = ["gemini-3-flash-preview", "gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3.8-flash", "gemini-flash-latest"];

const Field = ({ label, children, hint }) => (
  <label className="block space-y-1 text-sm"><span className="text-slate-600">{label}</span>{children}{hint && <span className="block text-xs text-slate-400">{hint}</span>}</label>
);

const Card = ({ icon: Icon, title, children, testId }) => (
  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5" data-testid={testId}>
    <h2 className="ori-title flex items-center gap-2 text-lg font-semibold text-[#1B2A3A]"><Icon size={18} className="text-[#16B8A7]" />{title}</h2>
    {children}
  </section>
);

const LLMCard = () => {
  const [s, setS] = useState(null);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState(null);
  useEffect(() => { api.get("/settings").then((r) => setS(r.data)); }, []);
  if (!s) return <Loader2 className="animate-spin text-slate-400" />;
  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });

  const save = async () => {
    setSaving(true);
    try {
      const body = { llm_backend: s.llm_backend, gemini_model: s.gemini_model, gemini_fallback_models: s.gemini_fallback_models,
        ollama_base_url: s.ollama_base_url, ollama_chat_model: s.ollama_chat_model, ollama_vision_model: s.ollama_vision_model };
      if (key.trim()) body.gemini_api_key = key.trim();
      const { data } = await api.put("/settings", body);
      setS(data); setKey(""); toast.success("Ajustes guardados");
    } catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); }
  };
  const runTest = async () => { setTest({ loading: true }); const { data } = await api.post("/settings/test-llm"); setTest(data); };

  return (
    <Card icon={Cpu} title="Proveedor de IA" testId="settings-llm-card">
      <div className="flex rounded-full bg-slate-100 p-1 w-fit" data-testid="settings-backend-selector">
        {[["gemini", "Google Gemini (clave propia)"], ["ollama", "Ollama (local)"]].map(([id, label]) => (
          <button key={id} data-testid={`settings-backend-${id}`} onClick={() => setS({ ...s, llm_backend: id })}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${s.llm_backend === id ? "bg-[#1B2A3A] text-white" : "text-slate-600"}`}>{label}</button>
        ))}
      </div>
      {s.llm_backend === "gemini" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Clave API de Gemini" hint={s.gemini_api_key_set ? `Clave guardada (${s.gemini_api_key_hint}). Deja vacío para mantenerla.` : "Sin clave configurada."}>
            <input data-testid="settings-gemini-key" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Pega una nueva clave" className={field} />
          </Field>
          <Field label="Modelo principal">
            <input data-testid="settings-gemini-model" list="gemini-models" value={s.gemini_model} onChange={set("gemini_model")} className={field} />
            <datalist id="gemini-models">{GEMINI_MODELS.map((m) => <option key={m} value={m} />)}</datalist>
          </Field>
          <Field label="Modelos de respaldo (coma)" hint="Se usan si el principal está saturado o alcanza el límite gratuito.">
            <input data-testid="settings-gemini-fallbacks" value={s.gemini_fallback_models} onChange={set("gemini_fallback_models")} className={field} />
          </Field>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="URL base de Ollama"><input data-testid="settings-ollama-url" value={s.ollama_base_url} onChange={set("ollama_base_url")} className={field} /></Field>
          <Field label="Modelo de chat"><input data-testid="settings-ollama-chat-model" value={s.ollama_chat_model} onChange={set("ollama_chat_model")} className={field} /></Field>
          <Field label="Modelo de visión (OCR)"><input data-testid="settings-ollama-vision-model" value={s.ollama_vision_model} onChange={set("ollama_vision_model")} className={field} /></Field>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button data-testid="settings-save-button" onClick={save} disabled={saving} className="rounded-full bg-[#1B2A3A] px-5 py-2 text-sm text-white hover:bg-[#14202C] disabled:opacity-60">Guardar</button>
        <button data-testid="settings-test-llm-button" onClick={runTest} className="flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm hover:border-[#3FE0D0]"><PlugZap size={14} />Probar conexión</button>
        {test?.loading && <Loader2 size={16} className="animate-spin text-slate-400" />}
        {test && !test.loading && (
          <span data-testid="settings-test-result" className={`flex items-center gap-1.5 text-sm ${test.ok ? "text-emerald-700" : "text-amber-700"}`}>
            {test.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}{test.message}
          </span>
        )}
      </div>
    </Card>
  );
};

const AccessCodeCard = () => {
  const { setToken } = useApp();
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const submit = async () => {
    if (f.next !== f.confirm) return toast.error("Los códigos nuevos no coinciden");
    try {
      const { data } = await api.post("/settings/access-code", { current_code: f.current, new_code: f.next });
      setToken(data.token); setF({ current: "", next: "", confirm: "" });
      toast.success("Código de acceso actualizado. Comunícalo al equipo.");
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Card icon={KeyRound} title="Código de acceso del equipo" testId="settings-access-card">
      <div className="grid gap-4 sm:grid-cols-3">
        {[["current", "Código actual"], ["next", "Nuevo código (mín. 6)"], ["confirm", "Repite el nuevo"]].map(([k, label]) => (
          <Field key={k} label={label}><input data-testid={`settings-access-${k}`} type="password" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={field} /></Field>
        ))}
      </div>
      <button data-testid="settings-access-save" onClick={submit} disabled={!f.current || f.next.length < 6}
        className="rounded-full bg-[#1B2A3A] px-5 py-2 text-sm text-white hover:bg-[#14202C] disabled:opacity-50">Cambiar código</button>
    </Card>
  );
};

const BackupCard = () => {
  const [exp, setExp] = useState(null);
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("merge");
  const [confirm, setConfirm] = useState(false);
  const [imp, setImp] = useState(null);
  const [result, setResult] = useState(null);

  const doExport = async () => {
    setExp(0);
    try {
      const r = await api.get("/backup/export", { responseType: "blob", onDownloadProgress: (e) => setExp(e.total ? Math.round((e.loaded * 100) / e.total) : 0) });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(r.data);
      a.download = `ori-copia-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Copia de seguridad exportada");
    } catch (e) { toast.error(errMsg(e)); } finally { setExp(null); }
  };
  const doImport = async () => {
    setConfirm(false); setResult(null); setImp({ pct: 0 });
    const fd = new FormData();
    fd.append("file", file);
    fd.append("mode", mode);
    try {
      const { data } = await api.post("/backup/import", fd, { onUploadProgress: (e) => setImp({ pct: e.total ? Math.round((e.loaded * 100) / e.total) : 0 }) });
      setResult(data); setFile(null); toast.success("Copia restaurada");
    } catch (e) { toast.error(errMsg(e)); } finally { setImp(null); }
  };
  const busy = exp !== null || imp !== null;

  return (
    <Card icon={DatabaseBackup} title="Copia de seguridad" testId="settings-backup-card">
      <p className="text-sm text-slate-500">Un único .zip con perfiles, carpetas, documentos (originales, texto y notas), chuletas, plantillas, conversaciones, favoritos, órdenes y ajustes. La clave de Gemini <b>no</b> se incluye. El índice de búsqueda se reconstruye al importar.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button data-testid="backup-export-button" onClick={doExport} disabled={busy} className="flex items-center gap-2 rounded-full bg-[#1B2A3A] px-5 py-2 text-sm text-white hover:bg-[#14202C] disabled:opacity-60">
          {exp !== null ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}Exportar copia de seguridad
        </button>
        {exp !== null && <span className="text-sm text-slate-500" data-testid="backup-export-progress">Preparando y descargando… {exp ? `${exp}%` : ""}</span>}
      </div>
      <div className="space-y-3 border-t border-slate-100 pt-4">
        <p className="text-sm font-medium text-[#1B2A3A]">Importar copia</p>
        <input data-testid="backup-import-file" type="file" accept=".zip" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-4 file:py-1.5" />
        <div className="flex rounded-full bg-slate-100 p-1 w-fit" data-testid="backup-mode-selector">
          {[["merge", "Fusionar"], ["replace", "Reemplazar todo"]].map(([id, label]) => (
            <button key={id} data-testid={`backup-mode-${id}`} onClick={() => setMode(id)}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${mode === id ? "bg-[#1B2A3A] text-white" : "text-slate-600"}`}>{label}</button>
          ))}
        </div>
        <p className="text-xs text-slate-400">{mode === "merge" ? "Añade los datos de la copia y sobrescribe los elementos que coincidan. Conserva el código de acceso actual." : "Borra TODOS los datos actuales y los sustituye por los de la copia (incluido el código de acceso del equipo)."}</p>
        <button data-testid="backup-import-button" onClick={() => setConfirm(true)} disabled={!file || busy} className="flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2 text-sm hover:border-[#3FE0D0] disabled:opacity-50">
          {imp ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}Importar copia
        </button>
        {imp && (
          <div data-testid="backup-import-progress" className="space-y-1 text-sm text-slate-500">
            <span>{imp.pct < 100 ? `Subiendo copia… ${imp.pct}%` : "Restaurando datos y reconstruyendo el índice…"}</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-[#3FE0D0] transition-[width]" style={{ width: `${imp.pct}%` }} /></div>
          </div>
        )}
        {result && (
          <div data-testid="backup-import-result" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            Copia restaurada ({result.mode === "replace" ? "reemplazo" : "fusión"}): {result.restored.documents} documentos, {result.restored.chunks} fragmentos, {result.restored.conversations} conversaciones, {result.restored.cheatsheets} chuletas, {result.restored.templates} plantillas, {result.files} archivos.
            <button data-testid="backup-reload-button" onClick={() => window.location.reload()} className="ml-2 underline">Recargar Ori</button>
          </div>
        )}
      </div>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} onConfirm={doImport} testId="backup-import-confirm"
        confirmLabel={mode === "replace" ? "Reemplazar todo" : "Fusionar"} title={mode === "replace" ? "¿Reemplazar todos los datos?" : "¿Fusionar la copia?"}
        description={mode === "replace" ? "Se borrarán todos los datos actuales de Ori y se sustituirán por los de la copia. No se puede deshacer." : "Los elementos de la copia se añadirán y sobrescribirán los que tengan el mismo identificador."} />
    </Card>
  );
};

const AutoBackupCard = () => {
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.get("/backup/auto").then((r) => { setS(r.data); window.dispatchEvent(new Event("ori:backup-status")); }).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  if (!s) return null;
  const toggle = async (enabled) => { const { data } = await api.put("/backup/auto", { enabled }); setS(data); };
  const runNow = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/backup/auto/run-now");
      if (data.status === "ok") toast.success("Copia de seguridad guardada"); else toast.error("No se pudo hacer la copia");
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); load(); }
  };
  const last = s.last;
  const when = (iso) => new Date(iso).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
  const mb = (b) => `${(b / 1e6).toFixed(1)} MB`;
  return (
    <Card icon={History} title="Copias automáticas" testId="settings-autobackup-card">
      <div className="flex items-center gap-3">
        <Switch data-testid="autobackup-toggle" checked={s.enabled} onCheckedChange={toggle} />
        <span className="text-sm text-slate-600">{s.enabled ? "Activadas" : "Desactivadas"}</span>
      </div>
      <p className="text-sm text-slate-500">Se hace una copia al abrir Ori y se guardan los últimos 3 días. Se guardan en <code className="rounded bg-slate-100 px-1.5 text-xs">{s.dir}</code>.</p>
      {last?.status === "error" && (
        <p data-testid="autobackup-error" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />La última copia automática ha fallado ({when(last.at)}): {last.error}. Prueba «Hacer copia ahora» o exporta una copia manual.
        </p>
      )}
      {last?.status === "ok" && (
        <p data-testid="autobackup-last" className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={15} />Última copia: {when(last.at)} · {mb(last.size)}</p>
      )}
      {!last && <p className="text-sm text-slate-400" data-testid="autobackup-none">Todavía no se ha hecho ninguna copia automática.</p>}
      {s.backups.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200" data-testid="autobackup-list">
          {s.backups.map((b) => (
            <li key={b.name} className="flex items-center gap-3 px-4 py-2 text-sm" data-testid={`autobackup-item-${b.name}`}>
              <span className="min-w-0 flex-1 truncate text-[#1B2A3A]">{b.name}</span>
              <span className="text-xs text-slate-400">{mb(b.size)}</span>
              <a data-testid={`autobackup-download-${b.name}`} href={`${API}/backup/auto/files/${encodeURIComponent(b.name)}?token=${encodeURIComponent(getToken() || "")}`}
                className="flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs hover:border-[#3FE0D0]"><Download size={12} />Descargar</a>
            </li>
          ))}
        </ul>
      )}
      <button data-testid="autobackup-run-now" onClick={runNow} disabled={busy || s.running}
        className="flex w-fit items-center gap-2 rounded-full bg-[#1B2A3A] px-5 py-2 text-sm text-white hover:bg-[#14202C] disabled:opacity-60">
        {busy || s.running ? <Loader2 size={15} className="animate-spin" /> : <History size={15} />}{busy || s.running ? "Guardando copia…" : "Hacer copia ahora"}
      </button>
    </Card>
  );
};

const LibraryCard = () => {
  const { profile } = useApp();
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.get("/library/status", { params: { profile_id: profile?.id } }).then((r) => setS(r.data)).catch(() => {}), [profile?.id]);
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);
  const reindex = async () => {
    setBusy(true);
    try {
      const r = await api.post("/library/reindex", null, { params: { profile_id: profile?.id } });
      setS(r.data);
      toast.success(r.data.requeued ? `Índice reconstruido · ${r.data.requeued} documentos en cola` : "Índice reconstruido");
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Card icon={Library} title="Biblioteca e índice" testId="settings-library-card">
      <p className="text-sm text-slate-600" data-testid="library-status-line">
        {s ? `Documentos: ${s.ready} listos · ${s.processing} procesando · ${s.error} con error · fragmentos indexados: ${s.indexed}` : "Cargando…"}
      </p>
      <p className="text-xs text-slate-400">Reconstruye el índice de búsqueda y vuelve a procesar los documentos atascados o con error.</p>
      <button data-testid="library-reindex-btn" onClick={reindex} disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg bg-[#1B2A3A] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a3d52] disabled:opacity-50 transition-colors">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}Reindexar biblioteca
      </button>
    </Card>
  );
};

const NetworkCard = () => {
  const [n, setN] = useState(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { api.get("/system/network").then((r) => setN(r.data)).catch(() => setN({ lan: [], tailscale_ips: [] })); }, []);
  if (!n) return null;
  const addr = (h) => `http://${h}:${n.port}`;
  const ts = n.tailscale_name || n.tailscale_ips?.[0];
  const shutdown = async () => { setConfirm(false); await api.post("/system/shutdown"); toast.success("Ori se está cerrando. Ya puedes cerrar esta pestaña."); };
  const link = "flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm hover:border-[#3FE0D0]";
  return (
    <Card icon={Wifi} title="Acceso desde otros equipos" testId="settings-network-card">
      {n.port ? (
        <div className="space-y-2 text-sm text-slate-600">
          {n.lan.length ? n.lan.map((ip) => (
            <p key={ip}>Dirección para tu equipo (misma red): <code className="rounded bg-slate-100 px-2 py-0.5 text-[#1B2A3A]" data-testid="settings-lan-address">{addr(ip)}</code></p>
          )) : <p>No se detecta conexión de red local.</p>}
          {ts ? <p>Desde casa con Tailscale: <code className="rounded bg-slate-100 px-2 py-0.5 text-[#1B2A3A]" data-testid="settings-tailscale-address">{addr(ts)}</code></p>
            : <p className="text-xs text-slate-400">Tailscale no detectado en este PC (opcional; ver la guía «PC del centro»).</p>}
        </div>
      ) : (
        <p className="text-sm text-slate-500" data-testid="settings-online-address">Estás usando Ori en <code className="rounded bg-slate-100 px-2 py-0.5">{window.location.origin}</code>. En el PC con Ori instalado verás aquí la dirección local para el equipo y la de Tailscale.</p>
      )}
      <div className="flex flex-wrap gap-3">
        <Link to="/descargas" data-testid="settings-downloads-link" className={link}><Download size={14} />Descargas e instalador</Link>
        <Link to="/ayuda" data-testid="settings-help-link" className={link}><BookOpen size={14} />Ayuda y guías</Link>
        {n.can_shutdown && <button data-testid="settings-shutdown-button" onClick={() => setConfirm(true)} className={`${link} text-red-600`}><Power size={14} />Cerrar Ori en este PC</button>}
      </div>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} onConfirm={shutdown} testId="settings-shutdown-confirm" confirmLabel="Cerrar Ori"
        title="¿Cerrar Ori en este PC?" description="Nadie del equipo podrá usarlo hasta que vuelvas a abrirlo con el acceso directo «Ori»." />
    </Card>
  );
};

export default function SettingsPage() {
  return (
    <div className="h-full overflow-y-auto bg-[#F8FAFC]" data-testid="settings-page">
      <div className="mx-auto max-w-4xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-4">
          <OriHero expression="wink" className="h-28" />
          <div>
            <h1 className="ori-title text-3xl sm:text-4xl font-bold tracking-tight text-[#1B2A3A]">Ajustes</h1>
            <p className="text-slate-500 text-sm">Proveedor de IA, acceso del equipo y copias de seguridad.</p>
          </div>
        </div>
        <LLMCard />
        <AccessCodeCard />
        <NetworkCard />
        <BackupCard />
        <AutoBackupCard />
        <LibraryCard />
      </div>
    </div>
  );
}
