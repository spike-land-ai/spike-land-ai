"use client";

import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface RegenerateButtonProps {
  slug: string;
}

export function RegenerateButton({ slug }: RegenerateButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/learnit/regenerate", {
        method: "POST",
        body: JSON.stringify({ slug }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        if (res.status === 401) {
          toast.error("You must be logged in to regenerate content.");
          return;
        }
        throw new Error("Regeneration failed");
      }

      toast.success("Content regenerated successfully!");
      router.refresh();
    } catch (error) {
      toast.error("Failed to regenerate content. Please try again.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleRegenerate}
      disabled={loading}
      className="gap-1.5 text-muted-foreground hover:text-foreground h-auto py-1 px-2"
      title="Regenerate this content with AI"
    >
      {loading
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <RefreshCw className="w-3.5 h-3.5" />}
      <span className="text-xs">
        {loading ? "Regenerating..." : "Regenerate"}
      </span>
    </Button>
  );
}
