import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const getToken = () => localStorage.getItem("ori_token");

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes("/auth/access")) {
      localStorage.removeItem("ori_token");
      window.dispatchEvent(new Event("ori-logout"));
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e) => {
  const d = e?.response?.data?.detail;
  if (!d) return e?.message || "Algo salió mal";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(" ");
  return String(d);
};

export const fileUrl = (id, download = false) =>
  `${API}/documents/${id}/file?token=${encodeURIComponent(getToken() || "")}${download ? "&download=true" : ""}`;

export async function streamChat(body, onEvent) {
  const res = await fetch(`${API}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail;
    try { detail = (await res.json()).detail; } catch { detail = null; }
    if (res.status === 401) window.dispatchEvent(new Event("ori-logout"));
    throw new Error(typeof detail === "string" ? detail : "Error en el chat");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 2);
      if (line.startsWith("data: ")) onEvent(JSON.parse(line.slice(6)));
    }
  }
}
