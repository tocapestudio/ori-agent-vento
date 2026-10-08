import { useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";

export const useFolderActions = ({ library, profileId, current, setCurrent, folders, reloadDocs }) => {
  const [nameDialog, setNameDialog] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const run = async (fn, okMsg) => {
    try { await fn(); if (okMsg) toast.success(okMsg); folders.reload(); reloadDocs(); return true; }
    catch (e) { toast.error(errMsg(e)); return false; }
  };

  const saveName = (name) => run(async () => {
    if (nameDialog.folder) await api.patch(`/folders/${nameDialog.folder.id}`, { name });
    else await api.post("/folders", { name, library, profile_id: profileId, parent_id: current });
    setNameDialog(null);
  }, nameDialog?.folder ? "Carpeta renombrada" : "Carpeta creada");

  const moveDoc = (docId, folderId) => run(() => api.post(`/documents/${docId}/move`, { folder_id: folderId }), "Documento movido");

  const confirmMove = (dest) => run(async () => {
    if (moveTarget.kind === "doc") await api.post(`/documents/${moveTarget.id}/move`, { folder_id: dest });
    else await api.patch(`/folders/${moveTarget.id}`, dest ? { parent_id: dest } : { move_to_root: true });
    setMoveTarget(null);
  }, "Movido correctamente");

  const deleteFolder = () => run(async () => {
    const { data } = await api.delete(`/folders/${toDelete.id}`);
    if (folders.descendantsOf(toDelete.id).has(current)) setCurrent(data.parent_id);
    setToDelete(null);
    toast.success(`Carpeta eliminada${data.deleted_documents ? ` junto con ${data.deleted_documents} documento(s)` : ""}`);
  });

  return {
    nameDialog, setNameDialog, saveName,
    moveTarget, setMoveTarget, confirmMove, moveDoc,
    toDelete, setToDelete, deleteFolder,
    openDocMove: (doc) => setMoveTarget({ kind: "doc", id: doc.id, name: doc.file_name, current: folders.folderOf(doc) }),
    openFolderMove: (f) => setMoveTarget({ kind: "folder", id: f.id, name: f.name, current: folders.byId[f.parent_id] ? f.parent_id : null, blocked: folders.descendantsOf(f.id) }),
  };
};
