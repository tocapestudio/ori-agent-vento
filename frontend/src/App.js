import "@/App.css";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AppProvider, useApp } from "@/context/AppContext";
import AccessGate from "@/pages/AccessGate";
import ProfilePicker from "@/pages/ProfilePicker";
import AppShell from "@/components/layout/AppShell";
import ChatPage from "@/pages/ChatPage";
import LibraryPage from "@/pages/LibraryPage";
import SettingsPage from "@/pages/SettingsPage";
import TemplatesPage from "@/pages/TemplatesPage";
import CalculatorsPage from "@/pages/CalculatorsPage";
import FavoritesPage from "@/pages/FavoritesPage";
import CheatsheetsPage from "@/pages/CheatsheetsPage";
import CheatsheetView from "@/pages/CheatsheetView";
import HelpPage from "@/pages/HelpPage";
import DownloadsPage from "@/pages/DownloadsPage";
import SetupWizard from "@/pages/SetupWizard";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const Gate = () => {
  const { token, profile } = useApp();
  const [setup, setSetup] = useState(null);
  useEffect(() => { api.get("/setup/status").then((r) => setSetup(r.data.needs_setup)).catch(() => setSetup(false)); }, []);
  if (setup === null) return null;
  if (setup) return <SetupWizard onDone={() => setSetup(false)} />;
  if (!token) return <AccessGate />;
  if (!profile) return <ProfilePicker />;
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/chat/:conversationId" element={<ChatPage />} />
        <Route path="/biblioteca" element={<LibraryPage />} />
        <Route path="/plantillas" element={<TemplatesPage />} />
        <Route path="/calculadoras" element={<CalculatorsPage />} />
        <Route path="/favoritos" element={<FavoritesPage />} />
        <Route path="/chuletas" element={<CheatsheetsPage />} />
        <Route path="/chuletas/:id" element={<CheatsheetView />} />
        <Route path="/ajustes" element={<SettingsPage />} />
        <Route path="/ayuda" element={<HelpPage />} />
        <Route path="/descargas" element={<DownloadsPage />} />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Route>
    </Routes>
  );
};

export default function App() {
  return (
    <div className="ori-app">
      <AppProvider>
        <BrowserRouter>
          <Gate />
        </BrowserRouter>
        <Toaster position="bottom-right" richColors />
      </AppProvider>
    </div>
  );
}
