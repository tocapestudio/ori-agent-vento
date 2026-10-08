import { useState } from "react";
import { Eye, Triangle, Ruler } from "lucide-react";
import { CalcCard, Grid, Invalid, NumField, Result, SelectField } from "@/components/calc/CalcUI";
import * as C from "@/lib/calc";

export const AccommodationCard = () => {
  const [age, setAge] = useState("");
  const [measured, setMeasured] = useState("");
  const a = C.num(age), m = C.num(measured);
  const err = age === "" ? null : C.validate([[Number.isFinite(a) && a >= 0 && a <= 100, "Edad entre 0 y 100 años"],
    [measured === "" || (Number.isFinite(m) && m >= 0 && m <= 30), "Amplitud medida entre 0 y 30 D"]]);
  const h = !err && age !== "" ? C.hofstetter(a) : null;
  const low = h && measured !== "" && m < h.min;
  return (
    <CalcCard id="accommodation" title="Amplitud de acomodación (Hofstetter)" icon={Eye}
      formula="Mín = 15 − 0,25·edad · Media = 18,5 − 0,3·edad · Máx = 25 − 0,4·edad"
      reference="Hofstetter HW (1950). Insuficiencia si la amplitud medida < mínima esperada para la edad.">
      <Grid><NumField id="calc-acc-age" label="Edad" unit="años" value={age} onChange={setAge} />
        <NumField id="calc-acc-measured" label="Amplitud medida (opcional)" unit="D" value={measured} onChange={setMeasured} /></Grid>
      <Invalid msg={err} id="calc-acc-error" />
      {h && <Grid cols={3}><Result id="calc-acc-min" label="Mínima" value={`${C.fmt(h.min)} D`} />
        <Result id="calc-acc-mean" label="Media" value={`${C.fmt(h.mean)} D`} /><Result id="calc-acc-max" label="Máxima" value={`${C.fmt(h.max)} D`} /></Grid>}
      {h && measured !== "" && <Result id="calc-acc-verdict" tone={low ? "warn" : "ok"} label="Valoración"
        value={low ? `Posible insuficiencia de acomodación (${C.fmt(h.min - m)} D bajo la mínima)` : "Dentro de lo esperado para la edad"} />}
    </CalcCard>
  );
};

export const PrismCard = () => {
  const [mode, setMode] = useState("deg");
  const [val, setVal] = useState("");
  const [cm, setCm] = useState("");
  const [power, setPower] = useState("");
  const v = C.num(val), c = C.num(cm), p = C.num(power);
  const errA = val === "" ? null : C.validate([[Number.isFinite(v) && v >= 0, "Introduce un valor positivo"], [mode !== "deg" || v < 90, "Ángulo menor de 90°"]]);
  const errB = cm === "" || power === "" ? null : C.validate([[Number.isFinite(c) && c >= 0 && c <= 5, "Descentramiento entre 0 y 5 cm"], [Number.isFinite(p) && Math.abs(p) <= 30, "Potencia entre −30 y +30 D"]]);
  const prentice = !errB && cm !== "" && power !== "" ? C.prentice(c, p) : null;
  return (
    <CalcCard id="prism" title="Prismas: grados ↔ Δ y regla de Prentice" icon={Triangle}
      formula="Δ = 100·tan(θ) · θ = arctan(Δ/100) · Prentice: Δ = c(cm)·D"
      reference="Definición de dioptría prismática; regla de Prentice. Lente positiva: base hacia el lado del descentramiento del centro óptico; negativa: base opuesta.">
      <Grid><SelectField id="calc-prism-mode" label="Convertir" value={mode} onChange={setMode} options={[["deg", "Grados → Δ"], ["pd", "Δ → grados"]]} />
        <NumField id="calc-prism-value" label={mode === "deg" ? "Ángulo" : "Prisma"} unit={mode === "deg" ? "°" : "Δ"} value={val} onChange={setVal} /></Grid>
      <Invalid msg={errA} id="calc-prism-error" />
      {!errA && val !== "" && <Result id="calc-prism-result" label="Resultado" value={mode === "deg" ? `${C.fmt(C.prismFromDeg(v))} Δ` : `${C.fmt(C.degFromPrism(v))}°`} />}
      <div className="border-t border-slate-100 pt-3" />
      <Grid><NumField id="calc-prentice-cm" label="Descentramiento" unit="cm" value={cm} onChange={setCm} />
        <NumField id="calc-prentice-power" label="Potencia de la lente (meridiano)" unit="D" value={power} onChange={setPower} /></Grid>
      <Invalid msg={errB} id="calc-prentice-error" />
      {prentice !== null && <Result id="calc-prentice-result" label="Prisma inducido" value={`${C.fmt(prentice)} Δ · base ${p >= 0 ? "hacia el descentramiento" : "opuesta al descentramiento"}`} />}
    </CalcCard>
  );
};

export const DemandCard = () => {
  const [mode, setMode] = useState("cm");
  const [val, setVal] = useState("");
  const v = C.num(val);
  const err = val === "" ? null : C.validate([[Number.isFinite(v) && v > 0, "Introduce un valor mayor que 0"]]);
  return (
    <CalcCard id="demand" title="Distancia de trabajo ↔ demanda acomodativa" icon={Ruler}
      formula="D = 1 / distancia (m) = 100 / distancia (cm)" reference="Vergencia del estímulo; ej. 40 cm → 2,50 D (sin corrección adicional).">
      <Grid><SelectField id="calc-demand-mode" label="Convertir" value={mode} onChange={setMode} options={[["cm", "Distancia → dioptrías"], ["d", "Dioptrías → distancia"]]} />
        <NumField id="calc-demand-value" label={mode === "cm" ? "Distancia" : "Demanda"} unit={mode === "cm" ? "cm" : "D"} value={val} onChange={setVal} /></Grid>
      <Invalid msg={err} id="calc-demand-error" />
      {!err && val !== "" && <Result id="calc-demand-result" label="Resultado" value={mode === "cm" ? `${C.fmt(C.demandFromCm(v))} D` : `${C.fmt(C.cmFromDemand(v), 1)} cm`} />}
    </CalcCard>
  );
};
