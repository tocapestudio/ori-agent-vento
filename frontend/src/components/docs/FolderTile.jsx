import { useState } from "react";
import { Folder, MoreVertical, Pencil, FolderInput, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DOC_DRAG_TYPE } from "@/components/docs/useFolders";

export const FolderTile = ({ folder, docCount, subCount, onOpen, onDropDoc, onRename, onMove, onDelete, grip }) => {
  const [over, setOver] = useState(false);
  return (
    <div data-testid={`folder-tile-${folder.id}`} onClick={() => onOpen(folder.id)}
      onDragOver={(e) => { if (e.dataTransfer.types.includes(DOC_DRAG_TYPE)) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(false); const d = e.dataTransfer.getData(DOC_DRAG_TYPE); if (d) onDropDoc(d, folder.id); }}
      className={`group flex h-[68px] cursor-pointer items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm transition-[box-shadow,border-color,background-color] hover:shadow-md ori-fade ${over ? "border-[#3FE0D0] bg-[#E6FAF8]" : "border-slate-200"}`}>
      {grip}
      <Folder size={22} className="shrink-0 fill-[#3FE0D0]/25 text-[#16B8A7]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[#1B2A3A]" data-testid={`folder-name-${folder.id}`}>{folder.name}</p>
        <p className="text-[11px] text-slate-400">{docCount} documento(s){subCount ? ` · ${subCount} carpeta(s)` : ""}</p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger data-testid={`folder-menu-${folder.id}`} onClick={(e) => e.stopPropagation()} aria-label="Opciones de carpeta"
          className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-[#1B2A3A] focus:outline-none">
          <MoreVertical size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem data-testid={`folder-rename-${folder.id}`} onClick={() => onRename(folder)}><Pencil size={14} className="mr-2" />Renombrar</DropdownMenuItem>
          <DropdownMenuItem data-testid={`folder-move-${folder.id}`} onClick={() => onMove(folder)}><FolderInput size={14} className="mr-2" />Mover a…</DropdownMenuItem>
          <DropdownMenuItem data-testid={`folder-delete-${folder.id}`} onClick={() => onDelete(folder)} className="text-red-600"><Trash2 size={14} className="mr-2" />Eliminar</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
