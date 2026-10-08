import { useState } from "react";
import { Glasses, Divide } from "lucide-react";
import { CalcCard, Grid, Invalid, NumField, Result } from "@/components/calc/CalcUI";
import * as C from "@/lib/calc";

const isRx = (v) => Number.isFinite(v) && Math.abs(v) <= 30;

export const RefractionCard = () => {
  const [s, setS] = useState("");
  const [c, setC] = useState("");
  const [axis, setAxis] = useState("");
  const [oldV, setOldV] = useState("12");
  const [newV, setNewV] = useState("0");
  const S = C.num(s), Cy = C.num(c), A = C.num(axis), o = C.num(oldV), n = C.num(newV);
  const ready = s !== "" && c !== "";
  const err = !ready ? null : C.validate([[isRx(S), "Esfera entre −30 y +30 D"], [isRx(Cy), "Cilindro entre −30 y +30 D"],
    [axis === "" || (Number.isFinite(A) && A >= 0 && A <= 180), "Eje entre 0 y 180°"],
    [Number.isFinite(o) && Number.isFinite(n) && o >= 0 && n >= 0 && o <= 30 && n <= 30, "Distancias al vértice entre 0 y 30 mm"]]);
  const ok = ready && !err;
  const t = ok && axis !== "" ? C.transpose(S, Cy, A) : null;
  const vs = ok ? C.vertexPower(S, o, n) : null;
  const vsc = ok ? C.vertexPower(S + Cy, o, n) : null;
  return (
    <CalcCard id="refraction" title="Equivalente esférico, transposición y vértice" icon={Glasses}
      formula="EE = Esf + Cil/2 · Transposición: Esf' = Esf + Cil, Cil' = −Cil, Eje ± 90° · Fc = F / (1 − d·F), d = (vértice actual − nuevo) en m"
      reference="Óptica oftálmica estándar. La potencia efectiva se calcula por meridiano principal (Esf y Esf+Cil).">
      <Grid cols={3}><NumField id="calc-rx-sphere" label="Esfera" unit="D" value={s} onChange={setS} />
        <NumField id="calc-rx-cyl" label="Cilindro" unit="D" value={c} onChange={setC} />
        <NumField id="calc-rx-axis" label="Eje" unit="°" value={axis} onChange={setAxis} /></Grid>
      <Grid><NumField id="calc-rx-vertex-old" label="Distancia al vértice actual" unit="mm" value={oldV} onChange={setOldV} />
        <NumField id="calc-rx-vertex-new" label="Nueva distancia (0 = lente de contacto)" unit="mm" value={newV} onChange={setNewV} /></Grid>
      <Invalid msg={err} id="calc-rx-error" />
      {ok && <Grid cols={3}>
        <Result id="calc-rx-se" label="Equivalente esférico" value={`${C.signed(C.sphericalEquivalent(S, Cy))} D`} />
        <Result id="calc-rx-transposed" label="Transposición" value={t ? `${C.signed(t.sphere)} ${C.signed(t.cyl)} × ${t.axis}°` : "Indica el eje"} />
        <Result id="calc-rx-vertex" label="Potencia en nuevo vértice" value={`${C.signed(vs)} / ${C.signed(vsc)} D`} />
      </Grid>}
    </CalcCard>
  );
};

export const ACACard = () => {
  const [pd, setPd] = useState("");
  const [near, setNear] = useState("");
  const [far, setFar] = useState("");
  const [dist, setDist] = useState("40");
  const [pWith, setPWith] = useState("");
  const [pWithout, setPWithout] = useState("");
  const [lens, setLens] = useState("-1");
  const v = [pd, near, far, dist].map(C.num);
  const g = [pWith, pWithout, lens].map(C.num);
  const readyH = [pd, near, far, dist].every((x) => x !== "");
  const errH = !readyH ? null : C.validate([[v.every(Number.isFinite), "Valores numéricos"], [v[0] >= 4 && v[0] <= 8, "DIP entre 4 y 8 cm"], [v[3] >= 10 && v[3] <= 100, "Distancia de cerca entre 10 y 100 cm"]]);
  const readyG = [pWith, pWithout, lens].every((x) => x !== "");
  const errG = !readyG ? null : C.validate([[g.every(Number.isFinite), "Valores numéricos"], [g[2] !== 0, "La lente no puede ser 0"]]);
  return (
    <CalcCard id="aca" title="Relación AC/A" icon={Divide}
      formula="Heterofórico: AC/A = DIP(cm) + (Foria cerca − Foria lejos) / Demanda cerca · Gradiente: AC/A = (Foria con lente − Foria sin lente) / (−Lente)"
      reference="Forias: endo (+), exo (−). Valor esperado 4 ± 2 Δ/D (Morgan; Scheiman & Wick).">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Método heterofórico</p>
      <Grid><NumField id="calc-aca-pd" label="DIP" unit="cm" value={pd} onChange={setPd} placeholder="6,2" />
        <NumField id="calc-aca-dist" label="Distancia de cerca" unit="cm" value={dist} onChange={setDist} />
        <NumField id="calc-aca-near" label="Foria cerca (endo +, exo −)" unit="Δ" value={near} onChange={setNear} />
        <NumField id="calc-aca-far" label="Foria lejos (endo +, exo −)" unit="Δ" value={far} onChange={setFar} /></Grid>
      <Invalid msg={errH} id="calc-aca-error" />
      {readyH && !errH && <Result id="calc-aca-heterophoric" label="AC/A calculado" value={`${C.fmt(C.acaHeterophoric(...v), 1)} Δ/D`} />}
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 pt-2">Método gradiente</p>
      <Grid cols={3}><NumField id="calc-aca-with" label="Foria con lente" unit="Δ" value={pWith} onChange={setPWith} />
        <NumField id="calc-aca-without" label="Foria sin lente" unit="Δ" value={pWithout} onChange={setPWithout} />
        <NumField id="calc-aca-lens" label="Lente añadida" unit="D" value={lens} onChange={setLens} /></Grid>
      <Invalid msg={errG} id="calc-aca-gradient-error" />
      {readyG && !errG && <Result id="calc-aca-gradient" label="AC/A gradiente" value={`${C.fmt(C.acaGradient(...g), 1)} Δ/D`} />}
    </CalcCard>
  );
};
