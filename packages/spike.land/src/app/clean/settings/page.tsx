"use client";

import { Button } from "@/components/ui/button";
import { CleanReminderForm } from "@/components/clean/CleanReminderForm";
import { CleanReminderList } from "@/components/clean/CleanReminderList";
import type { CleaningReminder } from "@/lib/clean/types";
import { Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export default function CleanSettingsPage() {
  const [reminders, setReminders] = useState<CleaningReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CleaningReminder | undefined>(
    undefined,
  );
  const [showForm, setShowForm] = useState(false);

  const fetchReminders = useCallback(async () => {
    try {
      const res = await fetch("/api/clean/reminders");
      if (res.ok) {
        const data = (await res.json()) as CleaningReminder[];
        setReminders(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReminders();
  }, [fetchReminders]);

  const handleSave = async (
    data: Omit<CleaningReminder, "id" | "enabled">,
  ) => {
    const url = editing
      ? `/api/clean/reminders/${editing.id}`
      : "/api/clean/reminders";
    const method = editing ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      await fetchReminders();
      setShowForm(false);
      setEditing(undefined);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/clean/reminders/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setReminders(prev => prev.filter(r => r.id !== id));
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    const res = await fetch(`/api/clean/reminders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (res.ok) {
      setReminders(prev => prev.map(r => (r.id === id ? { ...r, enabled } : r)));
    }
  };

  const handleEdit = (reminder: CleaningReminder) => {
    setEditing(reminder);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditing(undefined);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Reminders</h2>
          <p className="text-muted-foreground">
            Stay on track with cleaning reminders
          </p>
        </div>
        {!showForm && (
          <Button
            onClick={() => setShowForm(true)}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        )}
      </div>

      {showForm
        ? (
          <CleanReminderForm
            {...(editing !== undefined ? { reminder: editing } : {})}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        )
        : (
          <CleanReminderList
            reminders={reminders}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggle={handleToggle}
          />
        )}
    </div>
  );
}
