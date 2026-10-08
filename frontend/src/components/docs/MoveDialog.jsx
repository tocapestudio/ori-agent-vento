import { useEffect, useState } from "react";
import { Folder, Home, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

const Row = ({ id, label, depth, selected, disabled, onSelect, icon: Icon }) => (
  <button type="button" disabled={disabled} onClick={() => onSelect(id)} data-testid={`move-target-${id || "root"}`}
    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${selected ? "bg-[#E6FAF8] text-[#1B2A3A]" : "hover:bg-slate-100"} disabled:opacity-40 disabled:cursor-not-allowed`}
    style={{ paddingLeft: 12 + depth * 18 }}>
    <Icon size={15} className="text-[#16B8A7] shrink-0" /><span className="flex-1 truncate">{label}</span>
    {selected && <Check size={14} className="text-[#16B8A7]" />}
  </button>
);

export const MoveDialog = ({ target, folders, onClose, onMove }) => {
  const [dest, setDest] = useState(null);
  useEffect(() => { if (target) setDest(target.current ?? null); }, [target]);
  if (!target) return null;
  const blocked = target.blocked || new Set();

  const renderTree = (pid, depth) => folders.childrenOf(pid).flatMap((f) => [
    <Row key={f.id} id={f.id} label={f.name} depth={depth} icon={Folder} selected={dest === f.id} disabled={blocked.has(f.id)} onSelect={setDest} />,
    ...(blocked.has(f.id) ? [] : renderTree(f.id, depth + 1)),
  ]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="move-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="ori-title">Mover “{target.name}”</DialogTitle>
          <DialogDescription>Elige la carpeta de destino dentro de esta biblioteca.</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200 p-1" data-testid="move-tree">
          <Row id={null} label="Raíz de la biblioteca" depth={0} icon={Home} selected={dest === null} onSelect={setDest} />
          {renderTree(null, 1)}
        </div>
        <DialogFooter>
          <button data-testid="move-confirm" disabled={dest === (target.current ?? null)} onClick={() => onMove(dest)}
            className="rounded-full bg-[#1B2A3A] px-5 py-2 text-sm text-white hover:bg-[#14202C] disabled:opacity-50">Mover aquí</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
