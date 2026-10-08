// Recuerda la última conversación abierta (por perfil) para volver a ella al regresar al Chat.
const key = (pid) => `ori.lastConv.${pid}`;

export const getLastConv = (pid) => {
  try { return localStorage.getItem(key(pid)); } catch { return null; }
};

export const setLastConv = (pid, id) => {
  try {
    if (id) localStorage.setItem(key(pid), id);
    else localStorage.removeItem(key(pid));
  } catch { /* sin almacenamiento disponible */ }
};
