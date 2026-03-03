"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { BoxTier } from "@prisma/client";
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface CreateBoxFormProps {
  tiers: BoxTier[];
}

export function CreateBoxForm({ tiers }: CreateBoxFormProps) {
  const router = useRouter();
  const [selectedTierId, setSelectedTierId] = useState<string>(
    tiers[0]?.id || "",
  );
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !selectedTierId) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/boxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tierId: selectedTierId }),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error);
      }

      toast.success("Box created successfully!");
      router.push("/boxes");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to create box. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">1. Select a Tier</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {tiers.map(tier => {
            const isSelected = selectedTierId === tier.id;
            return (
              <Card
                key={tier.id}
                data-testid={`tier-card-${tier.name.toLowerCase()}`}
                className={cn(
                  "cursor-pointer transition-all hover:border-primary/50 relative",
                  isSelected ? "border-primary ring-2 ring-primary/20" : "",
                )}
                onClick={() => setSelectedTierId(tier.id)}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 text-primary">
                    <Check className="h-5 w-5" />
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{tier.name}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-medium">
                    {tier.cpu} vCPU • {tier.ram / 1024}GB RAM
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {tier.storage}GB Storage
                  </div>
                </CardContent>
                <CardFooter>
                  <div className="text-lg font-bold">
                    {tier.pricePerHour}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      tokens/hr
                    </span>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 max-w-md">
        <h2 className="text-xl font-semibold">2. Name your Box</h2>
        <div className="grid w-full items-center gap-1.5">
          <Label htmlFor="name">Box Name</Label>
          <Input
            type="text"
            id="name"
            placeholder="e.g. Chrome Research Agent"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            minLength={3}
            maxLength={50}
          />
        </div>
      </div>

      <div className="pt-4">
        <Button
          type="submit"
          size="lg"
          disabled={isLoading || !selectedTierId || !name}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Box
        </Button>
      </div>
    </form>
  );
}
