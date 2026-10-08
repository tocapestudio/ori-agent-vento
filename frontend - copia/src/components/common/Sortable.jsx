import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";

export const useOrder = (key) => {
  const [ids, setIds] = useState([]);
  useEffect(() => {
    let on = true;
    setIds([]);
    if (key) api.get(`/orders/${encodeURIComponent(key)}`).then((r) => on && setIds(r.data.ids));
    return () => { on = false; };
  }, [key]);
  const save = useCallback((visible) => {
    setIds((prev) => {
      const next = [...visible, ...prev.filter((x) => !visible.includes(x))];
      api.put(`/orders/${encodeURIComponent(key)}`, { ids: next }).catch(() => toast.error("No se pudo guardar el orden"));
      return next;
    });
  }, [key]);
  const replace = useCallback((next) => {
    setIds(next);
    api.put(`/orders/${encodeURIComponent(key)}`, { ids: next }).catch(() => toast.error("No se pudo guardar"));
  }, [key]);
  return [ids, save, replace];
};

export const applyOrder = (items, ids, mode = "custom", name = "name", date = "created_at") => {
  if (mode === "name") return [...items].sort((a, b) => String(a[name]).localeCompare(String(b[name]), "es", { sensitivity: "base", numeric: true }));
  if (mode === "date") return [...items].sort((a, b) => String(b[date]).localeCompare(String(a[date])));
  const pos = new Map(ids.map((id, i) => [id, i]));
  return [...items].sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9));
};

const ctl = "rounded p-0.5 text-slate-300 hover:text-[#1B2A3A] disabled:opacity-30";

const Item = ({ id, idx, count, disabled, handle, onStep, testPrefix, className, children }) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style = { transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 30 : undefined, opacity: isDragging ? 0.85 : 1 };
  const grip = handle && !disabled ? (
    <span className="no-print inline-flex shrink-0 items-center" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <button ref={setActivatorNodeRef} {...attributes} {...listeners} data-sort-handle draggable={false} data-testid={`${testPrefix}-handle-${id}`} aria-label="Arrastrar para reordenar" title="Arrastrar para reordenar"
        className="cursor-grab touch-none rounded p-0.5 text-slate-300 hover:text-[#1B2A3A] active:cursor-grabbing"><GripVertical size={14} /></button>
      <button data-testid={`${testPrefix}-up-${id}`} aria-label="Subir" title="Subir" disabled={idx === 0} onClick={() => onStep(id, -1)} className={ctl}><ChevronUp size={13} /></button>
      <button data-testid={`${testPrefix}-down-${id}`} aria-label="Bajar" title="Bajar" disabled={idx === count - 1} onClick={() => onStep(id, 1)} className={ctl}><ChevronDown size={13} /></button>
    </span>
  ) : null;
  const whole = !handle && !disabled ? { ...attributes, ...listeners } : {};
  return <div ref={setNodeRef} style={style} {...whole} className={`relative ${className || ""}`}>{children(grip)}</div>;
};

export const SortableList = ({ items, onReorder, render, disabled, handle = true, className, itemClassName, testPrefix = "sort" }) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const ids = items.map((i) => i.id);
  const move = (from, to) => { if (to >= 0 && to < ids.length && from !== to) onReorder(arrayMove(ids, from, to)); };
  const onDragEnd = ({ active, over }) => { if (over && active.id !== over.id) move(ids.indexOf(active.id), ids.indexOf(over.id)); };
  const onStep = (id, d) => { const i = ids.indexOf(id); move(i, i + d); };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className={className}>
          {items.map((it, i) => (
            <Item key={it.id} id={it.id} idx={i} count={items.length} disabled={disabled} handle={handle} onStep={onStep} testPrefix={testPrefix} className={itemClassName?.(it)}>
              {(grip) => render(it, grip)}
            </Item>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

export const SortSelect = ({ value, onChange, testId }) => (
  <select data-testid={testId} value={value} onChange={(e) => onChange(e.target.value)}
    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3FE0D0]">
    <option value="custom">Orden personalizado</option><option value="name">Nombre</option><option value="date">Fecha</option>
  </select>
);
