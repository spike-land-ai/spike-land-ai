"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
  email: z.string().email({ message: "Enter a valid email." }),
});

type FormValues = z.infer<typeof formSchema>;

export function FooterNewsletter() {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: FormValues) {
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email, source: "waitlist" }),
      });

      const data = await res.json() as { error?: string };

      if (!res.ok) {
        toast.error(data.error ?? "Failed to subscribe");
        return;
      }

      toast.success("You're on the list!");
      form.reset();
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Stay updated
      </p>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex items-start gap-2"
      >
        <div className="flex-1 space-y-1">
          <Input
            placeholder="your@email.com"
            {...form.register("email")}
            className="h-8 text-sm bg-transparent border-border placeholder:text-muted-foreground/50"
          />
          {form.formState.errors.email && (
            <p className="text-xs text-destructive">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={form.formState.isSubmitting}
          className="h-8 shrink-0"
        >
          {form.formState.isSubmitting ? "..." : "Join"}
        </Button>
      </form>
    </div>
  );
}
