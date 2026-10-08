import { useState } from "react";
import { CircleDot } from "lucide-react";
import { CalcCard, Grid, Invalid, NumField, Result, SelectField } from "@/components/calc/CalcUI";
import { num, fmt, signed } from "@/lib/calc";
import { clFromOverRefraction, clFromSpectacles } from "@/lib/clcalc";

const rx = (r) => (r.C ? `${signed(r.S)} ${signed(r.C)} × ${Math.round(r.ax)}°` : `${signed(r.S)} D esf.`);
const useRx = (s = "", c = "", a = "180") => {
  const [S, setS] = useState(s); const [C, setC] = useState(c); const [A, setA] = useState(a);
  return { S, setS, C, setC, A, setA, v: { S: num(S), C: C === "" ? 0 : num(C), ax: A === "" ? 180 : num(A) } };
};
const RxFields = ({ id, label, r }) => (
  <div className="space-y-1">
    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
    <Grid cols={3}><NumField id={`${id}-s`} label="Esfera" unit="D" value={r.S} onChange={r.setS} />
      <NumField id={`${id}-c`} label="Cilindro (−)" unit="D" value={r.C} onChange={r.setC} />
      <NumField id={`${id}-a`} label="Eje" unit="°" value={r.A} onChange={r.setA} /></Grid>
  </div>
);
const okRx = ({ S, C, ax }) => Number.isFinite(S) && Number.isFinite(C) && Math.abs(S) <= 30 && C <= 0 && C >= -10 && ax >= 0 && ax <= 180;

const RotationHelp = () => (
  <div className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500" data-testid="calc-cl-rotation-help">
    <svg width="54" height="54" viewBox="0 0 54 54" aria-hidden="true">
      <circle cx="27" cy="27" r="20" fill="none" stroke="#CBD5E1" strokeWidth="2" />
      <line x1="27" y1="27" x2="27" y2="47" stroke="#CBD5E1" strokeDasharray="2 2" />
      <line x1="27" y1="27" x2="17" y2="44.3" stroke="#16B8A7" strokeWidth="2.5" />
      <path d="M 23 46 A 20 20 0 0 1 15 41" fill="none" stroke="#1B2A3A" strokeWidth="1.5" markerEnd="url(#arr)" />
      <defs><marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#1B2A3A" /></marker></defs>
    </svg>
    <p>Rotación vista <b>por el examinador</b>. Si la marca inferior se desplaza a <b>tu izquierda</b> (sentido horario), es rotación a la izquierda: <b>LARS</b> → se <b>suma</b> (Left Add); a la derecha se <b>resta</b> (Right Subtract).</p>
  </div>
);

export const ContactLensCard = () => {
  const [mode, setMode] = useState("over");
  const lens = useRx(); const over = useRx("", "", "180"); const spec = useRx();
  const [vertex, setVertex] = useState("12");
  const [vmode, setVmode] = useState("ge4");
  const [rotDeg, setRotDeg] = useState("0");
  const [rotDir, setRotDir] = useState("left");
  const vtx = num(vertex); const deg = num(rotDeg);
  const rotation = (rotDir === "left" ? 1 : -1) * (Number.isFinite(deg) ? deg : 0);
  const inputs = mode === "over" ? [lens, over] : [spec];
  const ready = inputs.every((r) => r.S !== "");
  const err = !ready ? null : inputs.every((r) => okRx(r.v)) && vtx >= 0 && vtx <= 25 && deg >= 0 && deg <= 90 ? null
    : "Revisa los valores: esfera ±30 D, cilindro negativo (0 a −10), eje 0–180°, vértice 0–25 mm, rotación 0–90°";
  const res = ready && !err ? (mode === "over"
    ? clFromOverRefraction({ lens: lens.v, over: over.v, vertexMm: vtx, mode: vmode, rotation })
    : clFromSpectacles({ rx: spec.v, vertexMm: vtx, mode: vmode, rotation })) : null;

  return (
    <CalcCard id="cl" title="Lentes de contacto: sobrerrefracción y tóricas (LARS)" icon={CircleDot}
      formula="Vértice por meridiano: Fc = F / (1 − d·F) · Vectores: M = E + C/2, J0 = −(C/2)·cos2θ, J45 = −(C/2)·sin2θ · Eje en ojo = eje rotulado − rotación · Eje a pedir = eje necesario + rotación (LARS)"
      reference="Thibos (vectores de potencia), regla LARS. Orientativo: verifica con la calculadora/guía del fabricante.">
      <Grid>
        <SelectField id="calc-cl-mode" label="Modo" value={mode} onChange={setMode} options={[["over", "Sobrerrefracción con lente puesta"], ["spec", "Primera adaptación desde gafa"]]} />
        <SelectField id="calc-cl-vertex-mode" label="Corrección de vértice" value={vmode} onChange={setVmode} options={[["ge4", "Solo si |potencia| ≥ 4 D"], ["always", "Siempre"]]} />
      </Grid>
      {mode === "over" ? <><RxFields id="calc-cl-lens" label="Lente actual (rotulada)" r={lens} /><RxFields id="calc-cl-over" label="Sobrerrefracción (plano de gafa)" r={over} /></>
        : <RxFields id="calc-cl-spec" label="Refracción en gafa" r={spec} />}
      <Grid cols={3}>
        <NumField id="calc-cl-vertex" label="Distancia al vértice" unit="mm" value={vertex} onChange={setVertex} />
        <NumField id="calc-cl-rot-deg" label={mode === "over" ? "Rotación observada" : "Rotación esperada"} unit="°" value={rotDeg} onChange={setRotDeg} />
        <SelectField id="calc-cl-rot-dir" label="Sentido" value={rotDir} onChange={setRotDir} options={[["left", "Izquierda (horario)"], ["right", "Derecha (antihorario)"]]} />
      </Grid>
      <RotationHelp />
      <Invalid msg={err} id="calc-cl-error" />
      {res && (
        <div className="space-y-3">
          <ol className="list-decimal space-y-0.5 pl-5 text-xs text-slate-600" data-testid="calc-cl-steps">
            {mode === "over" ? <>
              <li>Eje de la lente en el ojo: {fmt(res.onEyeAxis, 0)}° ({rotation ? `${Math.abs(rotation)}° ${rotation > 0 ? "izquierda" : "derecha"}` : "sin rotación"})</li>
              <li>Sobrerrefracción en córnea: {rx(res.orC)} {res.orC.applied ? "(vértice aplicado)" : "(sin corrección de vértice)"}</li>
              <li>Potencia necesaria en el ojo (suma vectorial): {rx(res.needed)}</li>
              <li>Eje a pedir (LARS): {fmt(res.needed.ax, 0)}° {rotation >= 0 ? "+" : "−"} {Math.abs(rotation)}° = {fmt(res.ordered.ax, 0)}°</li>
            </> : <>
              <li>Refracción en córnea: {rx(res.cornea)} {res.cornea.applied ? "(vértice aplicado)" : "(sin corrección de vértice)"}</li>
              <li>Eje a pedir (LARS): {fmt(res.cornea.ax, 0)}° {rotation >= 0 ? "+" : "−"} {Math.abs(rotation)}° = {fmt(res.ordered.ax, 0)}°</li>
            </>}
          </ol>
          <Grid>
            <Result id="calc-cl-exact" label="Resultado exacto" value={rx(res.ordered)} />
            <Result id="calc-cl-suggested" tone="ok" label="Lente sugerida" value={rx(res.suggested)} />
          </Grid>
          <p className="text-xs text-slate-500" data-testid="calc-cl-note">{res.suggested.note}. Disponibilidad típica: esfera en pasos de 0,25 D (0,50 D más allá de ±6), cilindros −0,75/−1,25/−1,75/−2,25/−2,75, ejes cada 10°.</p>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="calc-cl-disclaimer">Orientativo: verifica con la calculadora/guía del fabricante.</p>
        </div>
      )}
    </CalcCard>
  );
};
