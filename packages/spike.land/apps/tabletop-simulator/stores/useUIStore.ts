"use client";
import { useCallback, useEffect, useState } from "react";

export type InteractionMode = "orbit" | "interaction";
export type SidebarTab = "players" | "chat" | "library";

export interface ContextMenuState {
  objectId: string;
  objectType: "card" | "deck" | "dice";
  position: { x: number; y: number; z: number };
}

export interface UIState {
  // Interaction mode
  interactionMode: InteractionMode;
  toggleMode: () => void;
  setInteractionMode: (mode: InteractionMode) => void;

  // Sidebar
  sidebarOpen: boolean;
  sidebarTab: SidebarTab;
  setSidebarOpen: (open: boolean) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  toggleSidebar: () => void;

  // Hand drawer
  handOpen: boolean;
  setHandOpen: (open: boolean) => void;
  toggleHand: () => void;

  // Context menu
  contextMenu: ContextMenuState | null;
  openContextMenu: (state: ContextMenuState) => void;
  closeContextMenu: () => void;

  // Device detection
  isMobile: boolean;
}

export function useUIStore(): UIState {
  // Interaction mode
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("orbit");

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("players");

  // Hand drawer
  const [handOpen, setHandOpen] = useState(false);

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Device detection
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile on mount
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || "ontouchstart" in window);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Mode toggle
  const toggleMode = useCallback(() => {
    setInteractionMode((prev) => (prev === "orbit" ? "interaction" : "orbit"));
  }, []);

  // Sidebar toggle
  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  // Hand toggle
  const toggleHand = useCallback(() => {
    setHandOpen((prev) => !prev);
  }, []);

  // Context menu functions
  const openContextMenu = useCallback((state: ContextMenuState) => {
    setContextMenu(state);
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  return {
    // Interaction mode
    interactionMode,
    toggleMode,
    setInteractionMode,

    // Sidebar
    sidebarOpen,
    sidebarTab,
    setSidebarOpen,
    setSidebarTab,
    toggleSidebar,

    // Hand drawer
    handOpen,
    setHandOpen,
    toggleHand,

    // Context menu
    contextMenu,
    openContextMenu,
    closeContextMenu,

    // Device detection
    isMobile,
  };
}
