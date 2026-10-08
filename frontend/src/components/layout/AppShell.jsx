import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { MessagesSquare, Library, Settings, Users, LogOut, ChevronDown, Calculator, FileStack, Star, NotebookPen, HelpCircle, Download, AlertTriangle } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { ProfileAvatar } from "@/components/layout/ProfileAvatar";

const BackupWarning = () => {
  const { pathname } = useLocation();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const check = () => api.get("/backup/auto").then((r) => setFailed(r.data.enabled && r.data.last?.status === "error")).catch(() => {});
    check();
    window.addEventListener("ori:backup-status", check);
    return () => window.removeEventListener("ori:backup-status", check);
  }, [pathname]);
  if (!failed) return null;
  return (
    <div data-testid="backup-failed-notice" className="flex items-center gap-2 bg-red-50 px-5 py-1.5 text-xs text-red-700 border-b border-red-100">
      <AlertTriangle size={13} />La última copia de seguridad automática ha fallado.
      <Link to="/ajustes" className="font-medium underline" data-testid="backup-failed-notice-link">Ver en Ajustes</Link>
    </div>
  );
};

const NAV = [
  { to: "/chat", label: "Chat", icon: MessagesSquare, id: "chat" },
  { to: "/biblioteca", label: "Biblioteca", icon: Library, id: "library" },
  { to: "/chuletas", label: "Chuletas", icon: NotebookPen, id: "cheatsheets" },
  { to: "/plantillas", label: "Plantillas", icon: FileStack, id: "templates" },
  { to: "/calculadoras", label: "Calculadoras", icon: Calculator, id: "calculators" },
  { to: "/favoritos", label: "Favoritos", icon: Star, id: "favorites" },
  { to: "/ajustes", label: "Ajustes", icon: Settings, id: "settings" },
  { to: "/ayuda", label: "Ayuda", icon: HelpCircle, id: "help" },
  { to: "/descargas", label: "Descargas", icon: Download, id: "downloads" },
];

export default function AppShell() {
  const { profile, setProfile, setToken } = useApp();

  useEffect(() => {
    api.get("/profiles").then(({ data }) => {
      const fresh = data.find((p) => p.id === profile.id);
      if (!fresh) setProfile(null);
      else if (fresh.name !== profile.name || fresh.color !== profile.color) setProfile(fresh);
    });
  }, [profile, setProfile]);

  return (
    <div className="h-screen flex flex-col bg-white">
      <header className="sticky top-0 z-40 flex items-center gap-6 border-b border-slate-200 bg-white/80 backdrop-blur-md px-5 h-16">
        <div className="flex items-center gap-2.5">
          <img src="/ori-icon.png" alt="Ori" width={34} height={34} className="h-[34px] w-[34px]" data-testid="header-ori-avatar" />
          <span className="ori-title text-xl font-bold text-[#1B2A3A]">Ori</span>
        </div>
        <nav className="flex items-center gap-1">
          {NAV.map(({ to, label, icon: Icon, id }) => (
            <NavLink key={to} to={to} data-testid={`nav-${id}`} title={label}
              className={({ isActive }) => `flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${isActive ? "bg-[#1B2A3A] text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              <Icon size={16} /> <span className="hidden xl:inline">{label}</span>
            </NavLink>
          ))}
        </nav>
        <DropdownMenu>
          <DropdownMenuTrigger data-testid="profile-menu-trigger" className="ml-auto flex items-center gap-2 rounded-full pl-1 pr-3 py-1 hover:bg-slate-100 focus:outline-none">
            <ProfileAvatar profile={profile} size={32} />
            <span className="text-sm font-medium text-[#1B2A3A] hidden sm:inline" data-testid="current-profile-name">{profile.name}</span>
            <ChevronDown size={14} className="text-slate-400" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem data-testid="switch-profile-button" onClick={() => setProfile(null)}><Users size={14} className="mr-2" />Cambiar de perfil</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem data-testid="logout-menu-button" onClick={() => { setProfile(null); setToken(null); }}><LogOut size={14} className="mr-2" />Cerrar sesión</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <BackupWarning />
      <main className="flex-1 min-h-0"><Outlet /></main>
    </div>
  );
}
