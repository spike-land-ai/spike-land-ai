"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useSession } from "@/lib/auth/client/hooks";
import { useAuthDialog } from "./AuthDialogProvider";

/**
 * Detects `?auth=required` query param and auto-opens the auth dialog.
 * Placed inside `<Suspense>` in the root layout since `useSearchParams()`
 * requires client-side navigation context.
 */
export function AuthDialogAutoOpen() {
  const searchParams = useSearchParams();
  const { openAuthDialog } = useAuthDialog();
  const { status } = useSession();
  const hasOpened = useRef(false);

  useEffect(() => {
    if (hasOpened.current) return;
    if (status === "loading") return;
    if (status === "authenticated") return;

    const authRequired = searchParams.get("auth");
    if (authRequired === "required") {
      const callbackUrl = searchParams.get("callbackUrl") || undefined;
      openAuthDialog({ callbackUrl });
      hasOpened.current = true;
    }
  }, [searchParams, openAuthDialog, status]);

  return null;
}
