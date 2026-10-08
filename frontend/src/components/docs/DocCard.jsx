import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Download, Pencil, Trash2, RefreshCw, Loader2, CheckCircle2, AlertCircle, ScanText, FileText, FileSpreadsheet, Presentation, Image as ImageIcon, FolderInput, Folder as FolderIcon, Sparkles } from "lucide-react";
import { fileUrl } from "@/lib/api";
import { DOC_DRAG_TYPE } from "@/components/docs/useFolders";

const TYPE_ICON = { pdf: FileText, docx: FileText, xlsx: FileSpreadsheet, pptx: Presentation, png: ImageIcon, jpg: ImageIcon };
const STATUS = {
  processing: { label: "Procesando", cls: "bg-blue-50 text-blue-700", Icon: Loader2, spin: true },
  ready: { label: "Listo", cls: "bg-emerald-50 text-emerald-700", Icon: CheckCircle2 },
  error: { label: "Error", cls: "bg-red-50 text-red-700", Icon: AlertCircle },
};
const size = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

const IconBtn = ({ label, testId, onClick, children, href, danger }) => {
  const cls = `h-8 w-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 ${danger ? "hover:text-red-600" : "hover:text-[#1B2A3A]"} transition-colors`;
  return href
    ? <a href={href} aria-label={label} title={label} data-testid={testId} className={cls}>{children}</a>
    : <button aria-label={label} title={label} data-testid={testId} onClick={onClick} className={cls}>{children}</button>;
};

export const DocCard = ({ doc, onPreview, onEdit, onDelete, onReprocess, onTag, onMove, path, grip }) => {
  const [hover, setHover] = useState(false);
  const fromHandle = useRef(false);
  const navigate = useNavigate();
  const TypeIcon = TYPE_ICON[doc.file_type] || FileText;
  const st = STATUS[doc.status];
  return (
    <div data-testid={`doc-card-${doc.id}`} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      draggable onPointerDownCapture={(e) => { fromHandle.current = !!e.target.closest("[data-sort-handle]"); }}
      onDragStart={(e) => { if (fromHandle.current) { e.preventDefault(); return; } e.dataTransfer.setData(DOC_DRAG_TYPE, doc.id); e.dataTransfer.effectAllowed = "move"; }}
      className="h-[244px] overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2.5 ori-fade cursor-grab active:cursor-grabbing">
      {path && <p className="flex items-center gap-1 text-[11px] text-slate-400 truncate -mb-1" data-testid={`doc-path-${doc.id}`}><FolderIcon size={11} />{path}</p>}
      <div className="flex items-start gap-3">
        <span className="h-10 w-10 shrink-0 rounded-lg bg-[#E6FAF8] text-[#16B8A7] flex items-center justify-center"><TypeIcon size={20} /></span>
        <div className="min-w-0 flex-1">
          <button onClick={() => onPreview(doc)} data-testid={`doc-name-${doc.id}`} title={doc.file_name} className="block w-full text-left text-sm font-medium text-[#1B2A3A] line-clamp-2 break-words hover:underline">{doc.file_name}</button>
          <p className="text-xs text-slate-400 mt-0.5">
            {doc.file_type.toUpperCase()}{doc.size ? ` · ${size(doc.size)}` : ""} · <span data-testid={`doc-chunks-${doc.id}`}>{doc.chunk_count} fragmentos</span>
          </p>
        </div>
        {grip && <span className="-mr-1 -mt-1 shrink-0">{grip}</span>}
      </div>
      {doc.status === "error" && <p className="text-xs text-red-600 line-clamp-2" title={doc.error} data-testid={`doc-error-${doc.id}`}>{doc.error}</p>}
      {doc.notes && doc.status !== "error" && <p className="text-xs text-slate-500 line-clamp-2 italic" data-testid={`doc-notes-${doc.id}`}>“{doc.notes}”</p>}
      <div className="flex flex-wrap gap-1.5 h-[22px] overflow-hidden" title={doc.tags.map((t) => `#${t}`).join(" ")}>
        {doc.ocr_used && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"><ScanText size={11} />OCR</span>}
        {doc.tags.map((t) => (
          <button key={t} onClick={() => onTag(t)} data-testid={`doc-tag-${doc.id}-${t}`} className="rounded-full bg-[#1B2A3A]/5 px-2 py-0.5 text-[11px] text-[#1B2A3A] hover:bg-[#3FE0D0]/30">#{t}</button>
        ))}
      </div>
      <div className={`mt-auto flex items-center gap-0.5 border-t border-slate-100 pt-2 transition-opacity ${hover ? "opacity-100" : "opacity-80"}`}>
        <span data-testid={`doc-status-${doc.id}`} data-status={doc.status} title={doc.error || ""} className={`mr-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>
          <st.Icon size={11} className={st.spin ? "animate-spin" : ""} />{st.label}
        </span>
        <IconBtn label="Ver" testId={`doc-preview-${doc.id}`} onClick={() => onPreview(doc)}><Eye size={15} /></IconBtn>
        {doc.has_original && <IconBtn label="Descargar" testId={`doc-download-${doc.id}`} href={fileUrl(doc.id, true)}><Download size={15} /></IconBtn>}
        <IconBtn label="Editar" testId={`doc-edit-${doc.id}`} onClick={() => onEdit(doc)}><Pencil size={15} /></IconBtn>
        {onMove && <IconBtn label="Mover a…" testId={`doc-move-${doc.id}`} onClick={() => onMove(doc)}><FolderInput size={15} /></IconBtn>}
        {doc.status === "ready" && <IconBtn label="Hacer chuleta" testId={`doc-cheatsheet-${doc.id}`} onClick={() => navigate(`/chuletas?docs=${doc.id}`)}><Sparkles size={15} /></IconBtn>}
        {doc.status === "error" && doc.has_original && <IconBtn label="Reprocesar" testId={`doc-reprocess-${doc.id}`} onClick={() => onReprocess(doc)}><RefreshCw size={15} /></IconBtn>}
        <span className="ml-auto" />
        <IconBtn label="Eliminar" danger testId={`doc-delete-${doc.id}`} onClick={() => onDelete(doc)}><Trash2 size={15} /></IconBtn>
      </div>
    </div>
  );
};
