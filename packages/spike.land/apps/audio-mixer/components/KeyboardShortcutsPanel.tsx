/**
 * KeyboardShortcutsPanel Component - Displays available keyboard shortcuts
 * Can be shown as a floating panel or modal
 */

"use client";

import { Keyboard, X } from "lucide-react";

interface ShortcutItem {
  keys: string[];
  description: string;
  category: string;
}

const SHORTCUTS: ShortcutItem[] = [
  // Playback
  { keys: ["Space"], description: "Play / Pause", category: "Playback" },
  { keys: ["S"], description: "Stop playback", category: "Playback" },
  { keys: ["Home"], description: "Go to start", category: "Playback" },
  { keys: ["End"], description: "Go to end", category: "Playback" },
  { keys: ["←"], description: "Seek backward 1s", category: "Playback" },
  { keys: ["→"], description: "Seek forward 1s", category: "Playback" },
  {
    keys: ["Shift", "←"],
    description: "Seek backward 5s",
    category: "Playback",
  },
  {
    keys: ["Shift", "→"],
    description: "Seek forward 5s",
    category: "Playback",
  },

  // Tracks
  { keys: ["↑"], description: "Select previous track", category: "Tracks" },
  { keys: ["↓"], description: "Select next track", category: "Tracks" },
  { keys: ["M"], description: "Mute selected track", category: "Tracks" },
  { keys: ["O"], description: "Solo selected track", category: "Tracks" },
  {
    keys: ["Delete"],
    description: "Delete selected track",
    category: "Tracks",
  },
  {
    keys: ["Backspace"],
    description: "Delete selected track",
    category: "Tracks",
  },

  // Timeline
  { keys: ["=", "+"], description: "Zoom in", category: "Timeline" },
  { keys: ["-"], description: "Zoom out", category: "Timeline" },
  { keys: ["0"], description: "Reset zoom", category: "Timeline" },
  { keys: ["G"], description: "Toggle snap to grid", category: "Timeline" },

  // Volume
  { keys: ["["], description: "Decrease track volume", category: "Volume" },
  { keys: ["]"], description: "Increase track volume", category: "Volume" },
  {
    keys: ["Shift", "["],
    description: "Decrease master volume",
    category: "Volume",
  },
  {
    keys: ["Shift", "]"],
    description: "Increase master volume",
    category: "Volume",
  },

  // File
  { keys: ["⌘/Ctrl", "O"], description: "Open audio file", category: "File" },
  { keys: ["⌘/Ctrl", "E"], description: "Export mix", category: "File" },
  { keys: ["R"], description: "Start/stop recording", category: "File" },

  // General
  { keys: ["?"], description: "Toggle shortcuts panel", category: "General" },
  { keys: ["Esc"], description: "Deselect / Close panel", category: "General" },
];

interface KeyboardShortcutsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsPanel({ isOpen, onClose }: KeyboardShortcutsPanelProps) {
  if (!isOpen) return null;

  // Group shortcuts by category
  const groupedShortcuts = SHORTCUTS.reduce(
    (acc, shortcut) => {
      if (!acc[shortcut.category]) {
        acc[shortcut.category] = [];
      }
      acc[shortcut.category]!.push(shortcut);
      return acc;
    },
    {} as Record<string, ShortcutItem[]>,
  );

  const categories = ["Playback", "Tracks", "Timeline", "Volume", "File", "General"];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        role="button"
        tabIndex={0}
        aria-label="Close keyboard shortcuts panel"
      />

      {/* Panel */}
      <div className="fixed right-4 top-20 bottom-4 w-80 bg-gray-800 rounded-xl shadow-2xl border border-gray-700 z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/80">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
            aria-label="Close shortcuts panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-2">
                {category}
              </h3>
              <div className="space-y-1">
                {groupedShortcuts[category]?.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-700/50 transition-colors"
                  >
                    <span className="text-sm text-gray-300">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <span key={keyIndex} className="flex items-center">
                          <kbd className="px-1.5 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs text-gray-200 font-mono min-w-[24px] text-center shadow-sm">
                            {key}
                          </kbd>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="text-gray-500 mx-0.5 text-xs">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-700 bg-gray-800/80">
          <p className="text-xs text-gray-500 text-center">
            Press <kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-300">?</kbd> or{" "}
            <kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-300">Esc</kbd> to close
          </p>
        </div>
      </div>
    </>
  );
}

// Mini floating hint for showing current shortcut action
interface ShortcutToastProps {
  action: string | null;
}

export function ShortcutToast({ action }: ShortcutToastProps) {
  if (!action) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up">
      <div className="px-4 py-2 bg-gray-800 rounded-full border border-gray-700 shadow-lg">
        <span className="text-sm text-white font-medium">{action}</span>
      </div>
    </div>
  );
}
