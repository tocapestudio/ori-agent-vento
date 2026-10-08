import { useState } from "react";
import { ChevronRight, Home, FolderPlus } from "lucide-react";
import { DOC_DRAG_TYPE } from "@/components/docs/useFolders";

const Crumb = ({ id, label, active, onOpen, onDropDoc, icon }) => {
  const [over, setOver] = useState(false);
  return (
    <button data-testid={`breadcrumb-${id || "root"}`} onClick={() => onOpen(id)}
      onDragOver={(e) => { if (e.dataTransfer.types.includes(DOC_DRAG_TYPE)) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(false); const d = e.dataTransfer.getData(DOC_DRAG_TYPE); if (d) onDropDoc(d, id); }}
      className={`flex items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors ${active ? "font-semibold text-[#1B2A3A]" : "text-slate-500 hover:text-[#1B2A3A] hover:bg-slate-100"} ${over ? "bg-[#E6FAF8] ring-1 ring-[#3FE0D0]" : ""}`}>
      {icon}{label}
    </button>
  );
};

export const FolderBar = ({ path, current, onOpen, onDropDoc, onNewFolder, libraryLabel }) => (
  <div className="flex flex-wrap items-center gap-2" data-testid="folder-bar">
    <nav className="flex flex-wrap items-center gap-0.5" data-testid="breadcrumbs">
      <Crumb id={null} label={libraryLabel} active={!current} onOpen={onOpen} onDropDoc={onDropDoc} icon={<Home size={14} />} />
      {path.map((f) => (
        <span key={f.id} className="flex items-center gap-0.5">
          <ChevronRight size={14} className="text-slate-300" />
          <Crumb id={f.id} label={f.name} active={f.id === current} onOpen={onOpen} onDropDoc={onDropDoc} />
        </span>
      ))}
    </nav>
    <button data-testid="new-folder-button" onClick={onNewFolder}
      className="ml-auto flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-600 hover:border-[#3FE0D0] hover:text-[#1B2A3A] transition-colors">
      <FolderPlus size={15} className="text-[#16B8A7]" />Nueva carpeta
    </button>
  </div>
);
