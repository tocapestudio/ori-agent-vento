import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export const FolderNameDialog = ({ open, title, initial = "", onClose, onSave }) => {
  const [name, setName] = useState("");
  useEffect(() => { if (open) setName(initial); }, [open, initial]);
  const submit = (e) => { e.preventDefault(); if (name.trim()) onSave(name.trim()); };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="folder-name-dialog" className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="ori-title">{title}</DialogTitle>
            <DialogDescription>Las carpetas solo organizan; Ori busca en todas.</DialogDescription>
          </DialogHeader>
          <input data-testid="folder-name-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
            placeholder="Nombre de la carpeta" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3FE0D0]" />
          <DialogFooter>
            <button type="submit" data-testid="folder-name-save" disabled={!name.trim()}
              className="rounded-full bg-[#1B2A3A] px-5 py-2 text-sm text-white hover:bg-[#14202C] disabled:opacity-50">Guardar</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
