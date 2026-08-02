import { ReactNode } from 'react';
import { GripVertical, X } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CockpitCardId } from '@/hooks/useCockpitLayout';

export interface CockpitCardSpec {
  id: CockpitCardId;
  title: string;
  /** O card fixo pode ser movido, mas não removido. */
  fixed?: boolean;
  content: ReactNode;
  /** Ações no cabeçalho do card (ex.: Recalcular / Publicar). */
  actions?: ReactNode;
}

function SortableCard({ spec, onRemove }: { spec: CockpitCardSpec; onRemove: (id: CockpitCardId) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: spec.id });

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('w-full min-w-0 overflow-hidden', isDragging && 'opacity-70 ring-2 ring-primary z-10 relative')}
    >

      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
            aria-label={`Mover card ${spec.title}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <CardTitle className="text-sm flex-1">{spec.title}</CardTitle>
          {spec.actions}
          {!spec.fixed && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              aria-label={`Remover card ${spec.title}`}
              onClick={() => onRemove(spec.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="min-w-0 overflow-hidden">{spec.content}</CardContent>
    </Card>
  );
}

export interface CockpitShellProps {
  cards: CockpitCardSpec[];
  onReorder: (ids: CockpitCardId[]) => void;
  onRemove: (id: CockpitCardId) => void;
}

export function CockpitShell({ cards, onReorder, onRemove }: CockpitShellProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = cards.map((c) => c.id);
    const from = ids.indexOf(active.id as CockpitCardId);
    const to = ids.indexOf(over.id as CockpitCardId);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(ids, from, to));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-4 w-full min-w-0 max-w-full">
          {cards.map((spec) => (
            <SortableCard key={spec.id} spec={spec} onRemove={onRemove} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
