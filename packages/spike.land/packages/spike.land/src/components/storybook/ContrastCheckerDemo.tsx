"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const sRGB = c / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function hexToRgb(hex: string): { r: number; g: number; b: number; } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result || !result[1] || !result[2] || !result[3]) return null;
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

function getContrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return 0;

  const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function ContrastCheckerDemo() {
  const [foreground, setForeground] = useState("#FFFFFF");
  const [background, setBackground] = useState("#08081C");
  const ratio = getContrastRatio(foreground, background);
  const passAA = ratio >= 4.5;
  const passAALarge = ratio >= 3;
  const passAAA = ratio >= 7;
  const passAAALarge = ratio >= 4.5;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="foreground">Foreground Color</Label>
          <div className="flex gap-2">
            <Input
              id="foreground"
              type="text"
              value={foreground}
              onChange={e => setForeground(e.target.value)}
              placeholder="#FFFFFF"
              className="font-mono"
            />
            <input
              type="color"
              value={foreground}
              onChange={e => setForeground(e.target.value)}
              className="w-12 h-10 rounded-lg cursor-pointer border border-border"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="background">Background Color</Label>
          <div className="flex gap-2">
            <Input
              id="background"
              type="text"
              value={background}
              onChange={e => setBackground(e.target.value)}
              placeholder="#08081C"
              className="font-mono"
            />
            <input
              type="color"
              value={background}
              onChange={e => setBackground(e.target.value)}
              className="w-12 h-10 rounded-lg cursor-pointer border border-border"
            />
          </div>
        </div>
      </div>

      <div
        className="p-8 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: background }}
      >
        <span className="text-2xl font-bold" style={{ color: foreground }}>
          Sample Text
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
          <span className="font-medium">Contrast Ratio</span>
          <span className="font-mono text-lg">{ratio.toFixed(2)}:1</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div
            className={`p-3 rounded-lg border ${
              passAA
                ? "border-green-500 bg-green-500/10"
                : "border-red-500 bg-red-500/10"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm">WCAG AA (Normal)</span>
              <Badge variant={passAA ? "default" : "destructive"}>
                {passAA ? "Pass" : "Fail"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Requires 4.5:1</p>
          </div>
          <div
            className={`p-3 rounded-lg border ${
              passAALarge
                ? "border-green-500 bg-green-500/10"
                : "border-red-500 bg-red-500/10"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm">WCAG AA (Large)</span>
              <Badge variant={passAALarge ? "default" : "destructive"}>
                {passAALarge ? "Pass" : "Fail"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Requires 3:1</p>
          </div>
          <div
            className={`p-3 rounded-lg border ${
              passAAA
                ? "border-green-500 bg-green-500/10"
                : "border-red-500 bg-red-500/10"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm">WCAG AAA (Normal)</span>
              <Badge variant={passAAA ? "default" : "destructive"}>
                {passAAA ? "Pass" : "Fail"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Requires 7:1</p>
          </div>
          <div
            className={`p-3 rounded-lg border ${
              passAAALarge
                ? "border-green-500 bg-green-500/10"
                : "border-red-500 bg-red-500/10"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm">WCAG AAA (Large)</span>
              <Badge variant={passAAALarge ? "default" : "destructive"}>
                {passAAALarge ? "Pass" : "Fail"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Requires 4.5:1</p>
          </div>
        </div>
      </div>
    </div>
  );
}
