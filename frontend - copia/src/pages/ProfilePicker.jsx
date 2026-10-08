import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { OriHero } from "@/components/ori/OriAvatar";
import { ProfileAvatar } from "@/components/layout/ProfileAvatar";
import { ProfileDialog } from "@/components/layout/ProfileDialog";
import { ConfirmDialog } from "@/components/layout/ConfirmDialog";

const ProfileCard = ({ p, onPick, onEdit, onDelete }) => (
  <div className="group relative flex flex-col items-center gap-3 ori-fade" data-testid={`profile-card-${p.id}`}>
    <button onClick={() => onPick(p)} data-testid={`profile-pick-${p.id}`}
      className="rounded-full transition-transform group-hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#3FE0D0] focus:ring-offset-4">
      <ProfileAvatar profile={p} size={104} className="shadow-sm" />
    </button>
    <span className="font-medium text-[#1B2A3A]" data-testid={`profile-name-${p.id}`}>{p.name}</span>
    <div className="absolute -top-1 right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button aria-label="Editar perfil" data-testid={`profile-edit-${p.id}`} onClick={() => onEdit(p)}
        className="h-7 w-7 rounded-full bg-white shadow ring-1 ring-slate-200 flex items-center justify-center hover:text-[#16B8A7]"><Pencil size={13} /></button>
      <button aria-label="Eliminar perfil" data-testid={`profile-delete-${p.id}`} onClick={() => onDelete(p)}
        className="h-7 w-7 rounded-full bg-white shadow ring-1 ring-slate-200 flex items-center justify-center hover:text-red-600"><Trash2 size={13} /></button>
    </div>
  </div>
);

export default function ProfilePicker() {
  const { setProfile, setToken, profile } = useApp();
  const [profiles, setProfiles] = useState([]);
  const [dialog, setDialog] = useState({ open: false, initial: null });
  const [toDelete, setToDelete] = useState(null);

  const load = useCallback(() => api.get("/profiles").then((r) => setProfiles(r.data)), []);
  useEffect(() => { load(); }, [load]);

  const save = async (body) => {
    try {
      if (dialog.initial) {
        const { data } = await api.patch(`/profiles/${dialog.initial.id}`, body);
        if (profile?.id === data.id) setProfile(data);
      } else await api.post("/profiles", body);
      setDialog({ open: false, initial: null });
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const remove = async () => {
    await api.delete(`/profiles/${toDelete.id}`);
    if (profile?.id === toDelete.id) setProfile(null);
    toast.success("Perfil eliminado");
    setToDelete(null);
    load();
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-6 py-14" data-testid="profile-picker">
      <button data-testid="logout-button" onClick={() => setToken(null)} className="absolute right-6 top-6 text-sm text-slate-500 hover:text-[#1B2A3A] flex items-center gap-1"><LogOut size={14} />Salir</button>
      <OriHero expression="waving" className="h-64 ori-float" testId="picker-ori-waving" />
      <h1 className="ori-title text-4xl sm:text-5xl font-bold tracking-tight text-[#1B2A3A] mt-2">¿Quién eres?</h1>
      <p className="text-slate-500 mt-2 mb-12">Elige tu perfil para ver tu biblioteca y tus conversaciones.</p>
      <div className="flex flex-wrap justify-center gap-12 max-w-4xl">
        {profiles.map((p) => (
          <ProfileCard key={p.id} p={p} onPick={setProfile} onEdit={(x) => setDialog({ open: true, initial: x })} onDelete={setToDelete} />
        ))}
        <div className="flex flex-col items-center gap-3">
          <button data-testid="profile-create-button" onClick={() => setDialog({ open: true, initial: null })}
            className="h-[104px] w-[104px] rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-[#3FE0D0] hover:text-[#16B8A7] transition-colors">
            <Plus size={32} />
          </button>
          <span className="text-slate-500">Nuevo perfil</span>
        </div>
      </div>
      <ProfileDialog open={dialog.open} initial={dialog.initial} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} onSave={save} />
      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} onConfirm={remove} testId="profile-delete-confirm"
        title={`¿Eliminar el perfil "${toDelete?.name}"?`}
        description="Se borrarán también su biblioteca personal y sus conversaciones. Esta acción no se puede deshacer." />
    </div>
  );
}
