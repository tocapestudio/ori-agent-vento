import { createContext, useCallback, useContext, useEffect, useState } from "react";

const AppCtx = createContext(null);

export const AppProvider = ({ children }) => {
  const [token, setTokenState] = useState(() => localStorage.getItem("ori_token"));
  const [profile, setProfileState] = useState(() => JSON.parse(localStorage.getItem("ori_profile") || "null"));

  const setToken = useCallback((t) => {
    if (t) localStorage.setItem("ori_token", t);
    else localStorage.removeItem("ori_token");
    setTokenState(t);
  }, []);

  const setProfile = useCallback((p) => {
    if (p) localStorage.setItem("ori_profile", JSON.stringify(p));
    else localStorage.removeItem("ori_profile");
    setProfileState(p);
  }, []);

  useEffect(() => {
    const onLogout = () => setTokenState(null);
    window.addEventListener("ori-logout", onLogout);
    return () => window.removeEventListener("ori-logout", onLogout);
  }, []);

  return <AppCtx.Provider value={{ token, setToken, profile, setProfile }}>{children}</AppCtx.Provider>;
};

export const useApp = () => useContext(AppCtx);
