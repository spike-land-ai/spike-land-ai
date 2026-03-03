"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { AuthDialog } from "./AuthDialog";

interface AuthDialogOptions {
  callbackUrl?: string;
}

interface AuthDialogContextValue {
  openAuthDialog: (options?: AuthDialogOptions) => void;
  closeAuthDialog: () => void;
  isOpen: boolean;
}

const AuthDialogContext = createContext<AuthDialogContextValue | null>(null);

export function useAuthDialog(): AuthDialogContextValue {
  const context = useContext(AuthDialogContext);
  if (!context) {
    throw new Error("useAuthDialog must be used within an AuthDialogProvider");
  }
  return context;
}

interface AuthDialogProviderProps {
  children: ReactNode;
}

export function AuthDialogProvider({ children }: AuthDialogProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState<string | undefined>();

  const openAuthDialog = useCallback((options?: AuthDialogOptions) => {
    setCallbackUrl(options?.callbackUrl);
    setIsOpen(true);
  }, []);

  const closeAuthDialog = useCallback(() => {
    setIsOpen(false);
    setCallbackUrl(undefined);
  }, []);

  return (
    <AuthDialogContext.Provider value={{ openAuthDialog, closeAuthDialog, isOpen }}>
      {children}
      <AuthDialog
        open={isOpen}
        onOpenChange={open => {
          if (!open) closeAuthDialog();
        }}
        callbackUrl={callbackUrl}
      />
    </AuthDialogContext.Provider>
  );
}
