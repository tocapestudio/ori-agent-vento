const toVec = (S, C, ax) => {
  const t = (2 * ax * Math.PI) / 180;
  return { M: S + C / 2, J0: -(C / 2) * Math.cos(t), J45: -(C / 2) * Math.sin(t) };
};
const fromVec = ({ M, J0, J45 }) => {
  const r = Math.hypot(J0, J45);
  const C = -2 * r;
  const ax = r < 1e-9 ? 180 : (0.5 * Math.atan2(J45, J0) * 180) / Math.PI;
  return { S: M - C / 2, C, ax: normAxis(ax) };
};
export const normAxis = (a) => {
  const x = ((a % 180) + 180) % 180;
  return x < 0.5 || x > 179.5 ? 180 : x;
};
const add = (a, b) => ({ M: a.M + b.M, J0: a.J0 + b.J0, J45: a.J45 + b.J45 });

export const toCornea = (S, C, ax, vertexMm, mode) => {
  const eff = (P) => (mode === "always" || Math.abs(P) >= 4 ? P / (1 - (vertexMm / 1000) * P) : P);
  const p1 = eff(S);
  const p2 = eff(S + C);
  return { S: p1, C: p2 - p1, ax, applied: mode === "always" || Math.abs(S) >= 4 || Math.abs(S + C) >= 4 };
};

const CYLS = [-0.75, -1.25, -1.75, -2.25, -2.75];
const roundSphere = (s) => { const step = Math.abs(s) > 6 ? 0.5 : 0.25; return Math.round(s / step) * step; };

export const suggestLens = ({ S, C, ax }) => {
  if (Math.abs(C) < 0.5) return { S: roundSphere(S + C / 2), C: 0, ax: null, note: "Cilindro < 0,50 D: lente esférica con el equivalente esférico" };
  const cyl = CYLS.reduce((b, c) => (Math.abs(c - C) < Math.abs(b - C) ? c : b), CYLS[0]);
  const M = S + C / 2;
  return { S: roundSphere(M - cyl / 2), C: cyl, ax: normAxis(Math.round(ax / 10) * 10), note: Math.abs(C) > 3 ? "Cilindro fuera del rango estándar: consulta fabricación a medida" : "Esfera ajustada para conservar el equivalente esférico" };
};

// rotation: signed degrees, + = izquierda (horario visto por el examinador), − = derecha
export const clFromOverRefraction = ({ lens, over, vertexMm, mode, rotation }) => {
  const onEyeAxis = normAxis(lens.ax - rotation);
  const orC = toCornea(over.S, over.C, over.ax, vertexMm, mode);
  const needed = fromVec(add(toVec(lens.S, lens.C, onEyeAxis), toVec(orC.S, orC.C, orC.ax)));
  const ordered = { ...needed, ax: normAxis(needed.ax + rotation) };
  return { onEyeAxis, orC, needed, ordered, suggested: suggestLens(ordered) };
};

export const clFromSpectacles = ({ rx, vertexMm, mode, rotation }) => {
  const c = toCornea(rx.S, rx.C, rx.ax, vertexMm, mode);
  const ordered = { S: c.S, C: c.C, ax: normAxis(rx.ax + rotation) };
  return { cornea: c, ordered, suggested: suggestLens(ordered) };
};
