import { useEffect, useRef, useState } from "react";
import { Send, Globe, ShieldAlert, Stethoscope, Activity, Trophy, FileSignature, Lightbulb, Ear, Headphones, Eye, ChevronDown, ChevronRight, FlaskConical } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { TemplatePicker, TemplateChip } from "@/components/chat/TemplatePicker";
import { MicButton } from "@/components/chat/MicButton";
import { useApp } from "@/context/AppContext";
import { SortableList, applyOrder, useOrder } from "@/components/common/Sortable";

export const QUICK_ACTIONS = [
  { id: "interpretar-caso", label: "Interpretar caso", icon: Stethoscope,
    text: "Interpreta este caso anonimizado, señala posibles problemas y sugiere pruebas complementarias:\n- Edad / actividad: \n- Motivo de consulta: \n- Refracción y AV: \n- Datos binoculares y acomodativos: \n" },
  { id: "protocolo-tv", label: "Protocolo terapia visual", icon: Activity,
    text: "Crea un protocolo de terapia visual (fases, ejercicios, frecuencia y criterios de progresión) para: " },
  { id: "plan-deportivo", label: "Plan entrenamiento deportivo", icon: Trophy,
    text: "Diseña un plan de entrenamiento visual deportivo (deporte, nivel, posición y objetivos): " },
  { id: "redactar-informe", label: "Redactar informe", icon: FileSignature,
    text: "Redacta un informe optométrico claro y profesional con estos datos anonimizados: " },
  { id: "ideas", label: "Ideas y adaptaciones", icon: Lightbulb,
    text: "Dame ideas y adaptaciones creativas (materiales, gamificación, ejercicios en casa) para: " },
  { id: "lentes-contacto", label: "Adaptación de lentes de contacto", icon: Eye,
    text: "Propón una adaptación de lentes de contacto (tipo de lente, parámetros iniciales: curva base, diámetro y potencia compensada por vértice, evaluación, seguimiento y cuidado) para este caso anonimizado:\n- Edad / uso previsto: \n- Refracción: \n- Queratometría / topografía: \n- Observaciones (lágrima, córnea, párpados): \n" },
  { id: "audiometria", label: "Interpretar audiometría", icon: Ear,
    text: "Interpreta esta audiometría anonimizada (tipo y grado de pérdida, configuración, posibles causas, pruebas complementarias y si conviene derivar a ORL):\n- Edad: \n- Umbrales vía aérea OD (250-8000 Hz): \n- Umbrales vía aérea OI: \n- Vía ósea: \n- Logoaudiometría / timpanometría: \n" },
  { id: "plan-audioprotesico", label: "Plan de adaptación audioprotésica", icon: Headphones,
    text: "Crea un plan de adaptación audioprotésica (selección, ajuste inicial, verificación, sesiones de seguimiento y consejos) para: " },
  { id: "investigacion", label: "Asistente de investigación", icon: FlaskConical,
    text: "Ayúdame con mi investigación (respuesta breve y práctica, paso a paso en JASP si aplica):\n- Objetivo / pregunta de investigación: \n- Diseño del estudio: \n- Variables (tipo y escala): \n- Qué análisis o duda tengo en JASP: \n" },
];

const SCOPES = [
  { id: "mine", label: "Mi biblioteca" },
  { id: "common", label: "Común" },
  { id: "both", label: "Ambas" },
];

export const QuickActions = ({ onPick, disabled }) => {
  const { profile } = useApp();
  const [order, saveOrder] = useOrder(`quick:${profile.id}`);
  return (
    <div data-testid="quick-actions" title="Arrastra los accesos para reordenarlos">
      <SortableList items={applyOrder(QUICK_ACTIONS, order)} onReorder={saveOrder} handle={false} testPrefix="quick-sort" className="flex flex-wrap justify-center gap-1.5"
        itemClassName={() => "shrink-0"}
        render={({ id, label, icon: Icon, text }) => (
          <button disabled={disabled} data-testid={`quick-action-${id}`} onClick={() => onPick(text)}
            className="flex whitespace-nowrap items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-[#3FE0D0] hover:text-[#1B2A3A] disabled:opacity-50 transition-colors">
            <Icon size={13} className="text-[#16B8A7]" />{label}
          </button>
        )} />
    </div>
  );
};

const QuickPanel = ({ hasMessages, disabled, onPick }) => {
  const [collapsed, setCollapsed] = useState(hasMessages);
  const auto = useRef(!hasMessages);
  useEffect(() => {
    if (!auto.current) return undefined;
    const t = setTimeout(() => { if (auto.current) { auto.current = false; setCollapsed(true); } }, 3000);
    return () => clearTimeout(t);
  }, []);
  const cancelAuto = () => { auto.current = false; };
  const toggle = () => { auto.current = false; setCollapsed((c) => !c); };
  return (
    <>
      <div className="flex items-center gap-3">
        <button data-testid="quick-actions-toggle" aria-expanded={!collapsed} onClick={toggle}
          className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-[#1B2A3A] transition-colors">
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}Acciones rápidas
        </button>
        {collapsed && (
          <span data-testid="anonymized-reminder" title="Recuerda usar únicamente casos anonimizados (sin nombres ni datos identificativos)."
            className="flex items-center gap-1 text-[11px] text-amber-700"><ShieldAlert size={12} />Solo casos anonimizados</span>
        )}
      </div>
      <div className="ori-collapse !mt-0" data-collapsed={collapsed} aria-hidden={collapsed} data-testid="quick-panel-body"
        onMouseEnter={cancelAuto} onPointerDown={cancelAuto} onFocusCapture={cancelAuto}>
        <div className="space-y-2 pt-2">
          <p className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5" data-testid="anonymized-banner">
            <ShieldAlert size={13} />Recuerda usar únicamente casos anonimizados (sin nombres ni datos identificativos).
          </p>
          <QuickActions disabled={disabled} onPick={onPick} />
        </div>
      </div>
    </>
  );
};

export const Composer = ({ value, setValue, scope, setScope, web, setWeb, onSend, busy, readOnly, inputRef, templates = [], template, setTemplate, hasMessages, viewKey }) => {
  const localRef = useRef(null);
  const ref = inputRef || localRef;
  if (readOnly) {
    return <div className="border-t border-slate-200 p-4 text-center text-sm text-slate-500" data-testid="composer-readonly">Estás viendo la conversación de otro perfil (solo lectura).</div>;
  }
  const submit = () => { if ((value.trim() || template) && !busy) onSend(); };
  return (
    <div className="border-t border-slate-200 bg-white px-6 pb-4 pt-2.5 space-y-2" data-testid="composer">
      <QuickPanel key={viewKey} hasMessages={hasMessages} disabled={busy} onPick={(t) => { setValue(t); setTimeout(() => ref.current?.focus(), 0); }} />
      {template && <TemplateChip template={template} onClear={() => setTemplate(null)} />}
      <div className="rounded-2xl border border-slate-200 focus-within:ring-2 focus-within:ring-[#3FE0D0] transition-shadow">
        <textarea ref={ref} data-testid="chat-input" rows={2} value={value} onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="Pregunta a Ori sobre tus documentos…" className="w-full resize-none rounded-2xl px-4 pt-3 text-sm focus:outline-none max-h-48" />
        <div className="flex flex-wrap items-center gap-3 px-3 pb-2.5">
          <div className="flex rounded-full bg-slate-100 p-0.5" data-testid="chat-scope-selector">
            {SCOPES.map((s) => (
              <button key={s.id} data-testid={`chat-scope-${s.id}`} onClick={() => setScope(s.id)}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${scope === s.id ? "bg-[#1B2A3A] text-white" : "text-slate-600 hover:text-[#1B2A3A]"}`}>{s.label}</button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <Switch data-testid="web-search-toggle" checked={web} onCheckedChange={setWeb} className="data-[state=checked]:bg-[#16B8A7]" />
            <Globe size={13} className={web ? "text-[#16B8A7]" : ""} />Buscar en internet
          </label>
          <TemplatePicker templates={templates} template={template} setTemplate={setTemplate} />
          <span className="ml-auto" />
          <MicButton value={value} setValue={setValue} disabled={busy} />
          <button data-testid="chat-send-button" disabled={busy || (!value.trim() && !template)} onClick={submit} aria-label="Enviar"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3FE0D0] text-[#1B2A3A] hover:brightness-95 disabled:opacity-40 transition-[filter,opacity]">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
