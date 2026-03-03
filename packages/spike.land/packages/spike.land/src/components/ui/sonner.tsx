"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success:
            "group-[.toaster]:border-l-4 group-[.toaster]:border-l-green-500 group-[.toaster]:bg-green-500/10",
          error:
            "group-[.toaster]:border-l-4 group-[.toaster]:border-l-destructive group-[.toaster]:bg-destructive/10",
          info:
            "group-[.toaster]:border-l-4 group-[.toaster]:border-l-primary group-[.toaster]:bg-primary/10",
          warning:
            "group-[.toaster]:border-l-4 group-[.toaster]:border-l-yellow-500 group-[.toaster]:bg-yellow-500/10",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
