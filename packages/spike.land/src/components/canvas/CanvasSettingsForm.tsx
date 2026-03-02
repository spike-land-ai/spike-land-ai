"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface CanvasSettings {
  rotation: 0 | 90 | 180 | 270;
  order: "album" | "random";
  interval: number;
}

interface CanvasSettingsFormProps {
  settings: CanvasSettings;
  onChange: (settings: CanvasSettings) => void;
}

const ROTATION_OPTIONS = [
  { value: "0", label: "No rotation" },
  { value: "90", label: "90 clockwise" },
  { value: "180", label: "180" },
  { value: "270", label: "270 clockwise" },
] as const;

const ORDER_OPTIONS = [
  { value: "album", label: "Album order" },
  { value: "random", label: "Random" },
] as const;

const MIN_INTERVAL = 5;
const MAX_INTERVAL = 60;

export function CanvasSettingsForm({ settings, onChange }: CanvasSettingsFormProps) {
  const handleRotationChange = (value: string) => {
    const rotation = parseInt(value, 10) as 0 | 90 | 180 | 270;
    onChange({ ...settings, rotation });
  };

  const handleOrderChange = (value: string) => {
    const order = value as "album" | "random";
    onChange({ ...settings, order });
  };

  const handleIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = parseInt(e.target.value, 10);
    let interval: number;

    if (isNaN(rawValue)) {
      interval = MIN_INTERVAL;
    } else if (rawValue < MIN_INTERVAL) {
      interval = MIN_INTERVAL;
    } else if (rawValue > MAX_INTERVAL) {
      interval = MAX_INTERVAL;
    } else {
      interval = rawValue;
    }

    onChange({ ...settings, interval });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="rotation">Rotation</Label>
        <Select value={settings.rotation.toString()} onValueChange={handleRotationChange}>
          <SelectTrigger id="rotation" data-testid="rotation-select">
            <SelectValue placeholder="Select rotation" />
          </SelectTrigger>
          <SelectContent>
            {ROTATION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="order">Order</Label>
        <Select value={settings.order} onValueChange={handleOrderChange}>
          <SelectTrigger id="order" data-testid="order-select">
            <SelectValue placeholder="Select order" />
          </SelectTrigger>
          <SelectContent>
            {ORDER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="interval">Interval</Label>
        <div className="flex items-center gap-2">
          <Input
            id="interval"
            type="number"
            min={MIN_INTERVAL}
            max={MAX_INTERVAL}
            value={settings.interval}
            onChange={handleIntervalChange}
            className="w-20"
            data-testid="interval-input"
          />
          <span className="text-sm text-muted-foreground">seconds</span>
        </div>
      </div>
    </div>
  );
}
