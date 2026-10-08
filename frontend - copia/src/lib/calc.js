export const num = (s) => (s === "" || s == null ? NaN : Number(String(s).replace(",", ".")));
export const fmt = (v, d = 2) => (Number.isFinite(v) ? (Math.round(v * 10 ** d) / 10 ** d).toFixed(d) : "—");
export const signed = (v, d = 2) => (Number.isFinite(v) ? `${v >= 0 ? "+" : ""}${fmt(v, d)}` : "—");

export const hofstetter = (age) => ({
  min: Math.max(0, 15 - 0.25 * age),
  mean: Math.max(0, 18.5 - 0.3 * age),
  max: Math.max(0, 25 - 0.4 * age),
});

export const prismFromDeg = (deg) => 100 * Math.tan((deg * Math.PI) / 180);
export const degFromPrism = (p) => (Math.atan(p / 100) * 180) / Math.PI;
export const prentice = (cm, D) => Math.abs(cm * D);

export const acaHeterophoric = (pdCm, nearPhoria, farPhoria, nearDistCm) => pdCm + (nearPhoria - farPhoria) / (100 / nearDistCm);
export const acaGradient = (phoriaWith, phoriaWithout, lens) => (phoriaWith - phoriaWithout) / -lens;

export const demandFromCm = (cm) => 100 / cm;
export const cmFromDemand = (D) => 100 / D;

export const sphericalEquivalent = (s, c) => s + c / 2;
export const transpose = (s, c, axis) => ({ sphere: s + c, cyl: -c, axis: axis > 90 ? axis - 90 : axis + 90 });
export const vertexPower = (F, oldMm, newMm) => F / (1 - ((oldMm - newMm) / 1000) * F);

export const sheard = (phoria, reserve) => (2 / 3) * phoria - (1 / 3) * reserve;
export const percival = (bi, bo) => {
  const G = Math.max(bi, bo);
  const L = Math.min(bi, bo);
  return { prism: G / 3 - (2 * L) / 3, base: bo >= bi ? "BO" : "BI", G, L };
};

export const validate = (rules) => {
  for (const [ok, msg] of rules) if (!ok) return msg;
  return null;
};
