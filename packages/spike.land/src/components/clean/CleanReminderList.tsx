"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { CleaningReminder } from "@/lib/clean/types";
import { Pencil, Trash2 } from "lucide-react";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

interface CleanReminderListProps {
  reminders: CleaningReminder[];
  onEdit: (reminder: CleaningReminder) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
}

export function CleanReminderList({
  reminders,
  onEdit,
  onDelete,
  onToggle,
}: CleanReminderListProps) {
  if (reminders.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        No reminders yet. Create one to stay on track!
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {reminders.map((reminder) => (
        <Card key={reminder.id} variant="solid">
          <CardContent className="flex items-center gap-4 p-4">
            <Switch
              checked={reminder.enabled}
              onCheckedChange={(checked) => onToggle(reminder.id, checked as boolean)}
              aria-label={`Toggle reminder at ${reminder.time}`}
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{reminder.time}</p>
              <p className="text-sm text-muted-foreground truncate">{reminder.message}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {reminder.days.map((d) => DAY_LABELS[d]).join(", ")}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onEdit(reminder)}
                aria-label="Edit reminder"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(reminder.id)}
                aria-label="Delete reminder"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
