"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";

interface WaitlistInlineFormProps {
  source?: string;
  className?: string;
}

export function WaitlistInlineForm(
  { source = "waitlist", className }: WaitlistInlineFormProps,
) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to join. Please try again.");
        return;
      }
      setSubmitted(true);
      toast.success("You're on the list!");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className={className}>
        <p className="text-sm text-green-400 font-medium">
          You're on the waiting list! We'll be in touch.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex items-start gap-2 ${className ?? ""}`}
    >
      <Input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/60"
      />
      <Button type="submit" disabled={submitting}>
        {submitting ? "..." : "Join"}
      </Button>
    </form>
  );
}
