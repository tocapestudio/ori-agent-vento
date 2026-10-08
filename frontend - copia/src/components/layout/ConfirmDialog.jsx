import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const ConfirmDialog = ({ open, onOpenChange, onConfirm, title, description, testId = "confirm-dialog", confirmLabel = "Eliminar" }) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent data-testid={testId}>
      <AlertDialogHeader>
        <AlertDialogTitle className="ori-title">{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel data-testid={`${testId}-cancel`}>Cancelar</AlertDialogCancel>
        <AlertDialogAction data-testid={`${testId}-confirm`} onClick={onConfirm} className="bg-red-600 hover:bg-red-700">{confirmLabel}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
