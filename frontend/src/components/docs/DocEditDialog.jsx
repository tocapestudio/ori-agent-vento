import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3FE0D0]";

export const DocEditDialog = ({ doc, onClose, onSave }) => {
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (doc) { setName(doc.file_name); setTags(doc.tags.join(", ")); setNotes(doc.notes); }
  }, [doc]);

  const save = () => onSave(doc, {
    file_name: name.trim() || doc.file_name,
    tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    notes,
  });

  return (
    <Dialog open={!!doc} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="doc-edit-dialog" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="ori-title">Editar documento</DialogTitle>
          <DialogDescription>Las etiquetas y notas también ayudan a Ori a responder.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block space-y-1 text-sm"><span className="text-slate-600">Nombre</span>
            <input data-testid="doc-edit-name" value={name} onChange={(e) => setName(e.target.value)} className={field} /></label>
          <label className="block space-y-1 text-sm"><span className="text-slate-600">Etiquetas (separadas por comas)</span>
            <input data-testid="doc-edit-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ambliopía, protocolos" className={field} /></label>
          <label className="block space-y-1 text-sm"><span className="text-slate-600">Notas (Ori las usa como conocimiento extra)</span>
            <textarea data-testid="doc-edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className={field} /></label>
        </div>
        <DialogFooter>
          <button data-testid="doc-edit-save" onClick={save} className="rounded-full bg-[#1B2A3A] px-5 py-2 text-sm text-white hover:bg-[#14202C]">Guardar</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
