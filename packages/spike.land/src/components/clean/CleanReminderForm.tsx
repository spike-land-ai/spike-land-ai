"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CleaningReminder } from "@/lib/clean/types";
import { useState } from "react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

interface CleanReminderFormProps {
  reminder?: CleaningReminder;
  onSave: (data: Omit<CleaningReminder, "id" | "enabled">) => void;
  onCancel: () => void;
}

export function CleanReminderForm({ reminder, onSave, onCancel }: CleanReminderFormProps) {
  const [time, setTime] = useState(reminder?.time ?? "09:00");
  const [days, setDays] = useState<number[]>(reminder?.days ?? [1, 2, 3, 4, 5]);
  const [message, setMessage] = useState(reminder?.message ?? "Time to tidy up!");

  const toggleDay = (dayIndex: number) => {
    setDays((prev) =>
      prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex) : [...prev, dayIndex].sort(),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ time, days, message });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{reminder ? "Edit Reminder" : "New Reminder"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reminder-time">Time</Label>
            <Input
              id="reminder-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Days</Label>
            <div className="flex flex-wrap gap-3">
              {DAYS.map((dayName, idx) => (
                <label key={dayName} className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox checked={days.includes(idx)} onCheckedChange={() => toggleDay(idx)} />
                  <span className="text-sm">{dayName}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminder-message">Message</Label>
            <Input
              id="reminder-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Reminder message..."
              maxLength={200}
              required
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={days.length === 0}>
              Save
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
