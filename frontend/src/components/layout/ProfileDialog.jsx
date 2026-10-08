import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { PROFILE_COLORS, ProfileAvatar } from "@/components/layout/ProfileAvatar";

export const ProfileDialog = ({ open, onOpenChange, initial, onSave }) => {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PROFILE_COLORS[0]);

  useEffect(() => {
    if (open) {
      setName(initial?.name || "");
      setColor(initial?.color || PROFILE_COLORS[Math.floor(Math.random() * PROFILE_COLORS.length)]);
    }
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="profile-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="ori-title">{initial ? "Editar perfil" : "Nuevo perfil"}</DialogTitle>
          <DialogDescription>Nombre y color del avatar. Los perfiles no tienen contraseña.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-4 py-2">
          <ProfileAvatar profile={{ name: name || "?", color }} size={64} />
          <input data-testid="profile-name-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40}
            placeholder="Nombre" autoFocus
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#3FE0D0]" />
        </div>
        <div className="flex flex-wrap gap-2" data-testid="profile-color-options">
          {PROFILE_COLORS.map((c) => (
            <button key={c} type="button" data-testid={`profile-color-${c.slice(1)}`} onClick={() => setColor(c)} aria-label={`Color ${c}`}
              className="h-8 w-8 rounded-full flex items-center justify-center ring-offset-2 transition-transform hover:scale-110"
              style={{ background: c, boxShadow: color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : "none" }}>
              {color === c && <Check size={14} className="text-white" />}
            </button>
          ))}
        </div>
        <DialogFooter>
          <button data-testid="profile-save-button" disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), color })}
            className="rounded-full bg-[#1B2A3A] px-5 py-2 text-sm text-white hover:bg-[#14202C] disabled:opacity-50">Guardar</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
