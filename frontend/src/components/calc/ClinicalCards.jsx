import { useState } from "react";
import { Scale, BookOpen } from "lucide-react";
import { CalcCard, Grid, Invalid, NumField, Result, SelectField } from "@/components/calc/CalcUI";
import * as C from "@/lib/calc";

const SheardBlock = () => {
  const [type, setType] = useState("exo");
  const [phoria, setPhoria] = useState("");
  const [reserve, setReserve] = useState("");
  const p = C.num(phoria), r = C.num(reserve);
  const ready = phoria !== "" && reserve !== "";
  const err = !ready ? null : C.validate([[Number.isFinite(p) && p >= 0 && p <= 50, "Magnitud de la foria entre 0 y 50 Δ"], [Number.isFinite(r) && r >= 0 && r <= 60, "Reserva entre 0 y 60 Δ"]]);
  const val = ready && !err ? C.sheard(p, r) : null;
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Criterio de Sheard</p>
      <Grid cols={3}>
        <SelectField id="calc-sheard-type" label="Tipo de foria" value={type} onChange={setType} options={[["exo", "Exoforia"], ["eso", "Endoforia"]]} />
        <NumField id="calc-sheard-phoria" label="Magnitud de la foria" unit="Δ" value={phoria} onChange={setPhoria} />
        <NumField id="calc-sheard-reserve" label={type === "exo" ? "Reserva BO (borrosidad/rotura)" : "Reserva BI (borrosidad/rotura)"} unit="Δ" value={reserve} onChange={setReserve} />
      </Grid>
      <Invalid msg={err} id="calc-sheard-error" />
      {val !== null && <Result id="calc-sheard-result" tone={val > 0 ? "warn" : "ok"} label="Prisma según Sheard"
        value={val > 0 ? `${C.fmt(val, 1)} Δ base ${type === "exo" ? "interna (BI)" : "externa (BO)"}` : "Cumple Sheard: no se requiere prisma"} />}
    </>
  );
};

const PercivalBlock = () => {
  const [bi, setBi] = useState("");
  const [bo, setBo] = useState("");
  const a = C.num(bi), b = C.num(bo);
  const ready = bi !== "" && bo !== "";
  const err = !ready ? null : C.validate([[Number.isFinite(a) && Number.isFinite(b) && a >= 0 && b >= 0 && a <= 60 && b <= 60, "Límites entre 0 y 60 Δ"]]);
  const res = ready && !err ? C.percival(a, b) : null;
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 pt-2">Criterio de Percival</p>
      <Grid><NumField id="calc-percival-bi" label="Límite BI (borrosidad o rotura)" unit="Δ" value={bi} onChange={setBi} />
        <NumField id="calc-percival-bo" label="Límite BO (borrosidad o rotura)" unit="Δ" value={bo} onChange={setBo} /></Grid>
      <Invalid msg={err} id="calc-percival-error" />
      {res && <Result id="calc-percival-result" tone={res.prism > 0 ? "warn" : "ok"} label="Prisma según Percival"
        value={res.prism > 0 ? `${C.fmt(res.prism, 1)} Δ base ${res.base === "BO" ? "externa (BO)" : "interna (BI)"}` : "Cumple Percival: no se requiere prisma"} />}
    </>
  );
};

export const PrismCriteriaCard = () => (
  <CalcCard id="criteria" title="Prisma recomendado: Sheard y Percival" icon={Scale}
    formula="Sheard: P = ⅔·Foria − ⅓·Reserva compensadora · Percival: P = ⅓·G − ⅔·L (G = mayor, L = menor de los límites BI/BO)"
    reference="Sheard (1930): la reserva compensadora debe ser ≥ 2× la foria. Percival (1928): el punto de demanda en el tercio medio del rango. P ≤ 0 → no se requiere prisma.">
    <SheardBlock /><PercivalBlock />
  </CalcCard>
);

const NORMS = [
  ["Vergencia BI lejos (borrosidad / rotura / recobro)", "— / 7 ± 3 / 4 ± 2 Δ", "Morgan (1944)"],
  ["Vergencia BO lejos (borrosidad / rotura / recobro)", "9 ± 4 / 19 ± 8 / 10 ± 4 Δ", "Morgan (1944)"],
  ["Vergencia BI cerca 40 cm (borrosidad / rotura / recobro)", "13 ± 4 / 21 ± 4 / 13 ± 5 Δ", "Morgan (1944)"],
  ["Vergencia BO cerca 40 cm (borrosidad / rotura / recobro)", "17 ± 5 / 21 ± 6 / 11 ± 7 Δ", "Morgan (1944)"],
  ["Foria lejos", "1 ± 2 Δ exo", "Morgan (1944)"],
  ["Foria cerca (40 cm)", "3 ± 3 Δ exo", "Morgan (1944)"],
  ["AC/A", "4 ± 2 Δ/D", "Morgan; Scheiman & Wick"],
  ["Flexibilidad acomodativa monocular (±2,00 D, adultos)", "11 ± 5 cpm", "Scheiman & Wick"],
  ["Flexibilidad acomodativa binocular (±2,00 D, adultos)", "8 ± 5 cpm", "Scheiman & Wick (Zellers)"],
  ["PPC con estímulo acomodativo (rotura / recobro)", "5 / 7 cm", "Scheiman & Wick"],
  ["PPC con linterna y filtro rojo-verde (rotura / recobro)", "7 / 10 cm", "Scheiman & Wick"],
  ["ARN / ARP", "+2,00 ± 0,50 D / −2,37 ± 1,00 D", "Morgan (1944)"],
  ["MEM (retraso acomodativo)", "+0,25 a +0,50 D", "Scheiman & Wick"],
];

export const NormsTable = () => (
  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 lg:col-span-2" data-testid="calc-norms">
    <h2 className="ori-title flex items-center gap-2 text-lg font-semibold text-[#1B2A3A]"><BookOpen size={18} className="text-[#16B8A7]" />Valores normativos de referencia</h2>
    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="calc-norms-disclaimer">
      Normas de referencia (solo lectura). Dependen del método, el estímulo y la población; contrástalas con tu bibliografía y tus protocolos.
    </p>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-400">
          <th className="py-2 pr-4 font-semibold">Prueba</th><th className="py-2 pr-4 font-semibold">Valor esperado</th><th className="py-2 font-semibold">Fuente</th></tr></thead>
        <tbody>{NORMS.map(([t, v, s], i) => (
          <tr key={t} className="border-b border-slate-100 last:border-0" data-testid={`calc-norm-row-${i}`}>
            <td className="py-2.5 pr-4 text-slate-700">{t}</td><td className="py-2.5 pr-4 font-medium text-[#1B2A3A] whitespace-nowrap">{v}</td><td className="py-2.5 text-xs text-slate-500">{s}</td>
          </tr>))}</tbody>
      </table>
    </div>
  </section>
);
