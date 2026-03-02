/**
 * SortableTrackList Component - Drag and drop track reordering
 * Resolves #332
 */

"use client";

import type { DragEndEvent } from "@dnd-kit/core";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { AudioTrack } from "../types";
import { TrackItem } from "./TrackItem";

interface SortableTrackItemProps {
  id: string;
  track: AudioTrack;
  onPlay: () => void;
  onStop: () => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onSoloToggle: () => void;
  onRemove: () => void;
  onSeek?: ((progress: number) => void) | undefined;
  onDelayChange?: ((delay: number) => void) | undefined;
  onTrimChange?: ((trimStart: number, trimEnd: number) => void) | undefined;
}

function SortableTrackItem({
  id,
  track,
  onPlay,
  onStop,
  onVolumeChange,
  onMuteToggle,
  onSoloToggle,
  onRemove,
  onSeek,
  onDelayChange,
  onTrimChange,
}: SortableTrackItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center cursor-grab active:cursor-grabbing z-10 hover:bg-gray-700/50 rounded-l-lg transition-colors"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4 text-gray-400" />
      </div>

      {/* Track Item with padding for drag handle */}
      <div className="pl-8">
        <TrackItem
          track={track}
          onPlay={onPlay}
          onStop={onStop}
          onVolumeChange={onVolumeChange}
          onMuteToggle={onMuteToggle}
          onSoloToggle={onSoloToggle}
          onRemove={onRemove}
          onSeek={onSeek}
          onDelayChange={onDelayChange}
          onTrimChange={onTrimChange}
        />
      </div>
    </div>
  );
}

interface SortableTrackListProps {
  tracks: AudioTrack[];
  onReorder: (newOrder: string[]) => void;
  onPlay: (id: string) => void;
  onStop: (id: string) => void;
  onVolumeChange: (id: string, volume: number) => void;
  onMuteToggle: (id: string) => void;
  onSoloToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onSeek?: ((id: string, progress: number) => void) | undefined;
  onDelayChange?: ((id: string, delay: number) => void) | undefined;
  onTrimChange?: ((id: string, trimStart: number, trimEnd: number) => void) | undefined;
}

export function SortableTrackList({
  tracks,
  onReorder,
  onPlay,
  onStop,
  onVolumeChange,
  onMuteToggle,
  onSoloToggle,
  onRemove,
  onSeek,
  onDelayChange,
  onTrimChange,
}: SortableTrackListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = tracks.findIndex((t) => t.id === active.id);
      const newIndex = tracks.findIndex((t) => t.id === over.id);
      const newOrder = arrayMove(
        tracks.map((t) => t.id),
        oldIndex,
        newIndex,
      );
      onReorder(newOrder);
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={tracks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {tracks.map((track) => (
            <SortableTrackItem
              key={track.id}
              id={track.id}
              track={track}
              onPlay={() => onPlay(track.id)}
              onStop={() => onStop(track.id)}
              onVolumeChange={(volume) => onVolumeChange(track.id, volume)}
              onMuteToggle={() => onMuteToggle(track.id)}
              onSoloToggle={() => onSoloToggle(track.id)}
              onRemove={() => onRemove(track.id)}
              onSeek={onSeek ? (progress) => onSeek(track.id, progress) : undefined}
              onDelayChange={onDelayChange ? (delay) => onDelayChange(track.id, delay) : undefined}
              onTrimChange={
                onTrimChange ? (start, end) => onTrimChange(track.id, start, end) : undefined
              }
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
