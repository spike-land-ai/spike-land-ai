"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/components/ui/link";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { EnhancementTier } from "@prisma/client";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

interface EnhancementSettingsProps {
  onEnhance: (tier: EnhancementTier) => Promise<void>;
  currentBalance: number;
  isProcessing: boolean;
  completedVersions: Array<{ tier: EnhancementTier; url: string }>;
  asCard?: boolean;
  // New props for dialog mode
  imageUrl?: string;
  imageName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  onCancel?: () => void;
}

// User-friendly display info for tiers
const TIER_DISPLAY_INFO = {
  FREE: {
    name: "Free",
    tagline: "Nano model preview",
    cost: 0,
  },
  TIER_1K: {
    name: "Standard",
    tagline: "Balanced quality & speed",
    cost: 2,
  },
  TIER_2K: {
    name: "Pro",
    tagline: "Higher detail, slower",
    cost: 5,
  },
  TIER_4K: {
    name: "Ultra",
    tagline: "Maximum detail, slowest",
    cost: 10,
  },
} as const;

// Ordered array of tiers for consistent rendering (FREE only available in mix mode)
const TIER_ORDER: EnhancementTier[] = ["TIER_1K", "TIER_2K", "TIER_4K"];

export function EnhancementSettings({
  onEnhance,
  currentBalance,
  isProcessing,
  completedVersions,
  asCard = true,
  imageUrl,
  imageName,
  open,
  onOpenChange,
  trigger,
  onCancel,
}: EnhancementSettingsProps) {
  const [selectedTier, setSelectedTier] = useState<EnhancementTier>("TIER_2K");

  const handleEnhance = async () => {
    await onEnhance(selectedTier);
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange?.(false);
  };

  // Check if a version already exists for the selected tier
  const versionExists = completedVersions.some((v) => v.tier === selectedTier);

  // Check if user has enough tokens for the selected tier
  const tierCost = TIER_DISPLAY_INFO[selectedTier].cost;
  const hasEnoughTokens = currentBalance >= tierCost || !currentBalance; // during loading treat as enough
  // Main content component - shared between card and dialog modes
  const content = (
    <div className="space-y-6">
      {/* Image Preview Section - only in dialog mode */}
      {(imageUrl || imageName) && (
        <div className="flex gap-4">
          {imageUrl && (
            <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/10">
              <Image
                src={imageUrl}
                alt={imageName || "Selected image"}
                fill
                className="object-cover"
              />
            </div>
          )}
          <div className="flex-1 space-y-2">
            <div>
              <p className="text-sm font-medium text-foreground">Selected Image</p>
              <Label htmlFor="image-name" className="text-xs text-muted-foreground">
                Image Name
              </Label>
            </div>
            <Input id="image-name" value={imageName || ""} readOnly className="bg-white/10" />
          </div>
        </div>
      )}

      {/* Balance display - only in card mode */}
      {asCard && !trigger && (
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">Your Balance</span>
          </div>
          <span className="text-lg font-bold">{currentBalance} credits</span>
        </div>
      )}

      {/* Insufficient funds warning */}
      {!hasEnoughTokens && (
        <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">Insufficient Credits</p>
              <p className="text-sm text-muted-foreground">
                You need {tierCost} credits but only have {currentBalance}
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="destructive" className="w-full mt-2">
            <Link href="/pricing">
              <Sparkles className="mr-2 h-4 w-4" />
              Upgrade Plan
            </Link>
          </Button>
        </div>
      )}

      {/* Tier Selection */}
      <div>
        <Label className="text-sm font-medium mb-3 block">Enhancement Level</Label>
        <RadioGroup
          value={selectedTier}
          onValueChange={(value) => setSelectedTier(value as EnhancementTier)}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          {TIER_ORDER.map((tier) => {
            const info = TIER_DISPLAY_INFO[tier];
            const canAfford = currentBalance >= info.cost;
            const isSelected = selectedTier === tier;

            return (
              <div key={tier} className="relative">
                <RadioGroupItem
                  value={tier}
                  id={tier}
                  disabled={!canAfford}
                  className="peer sr-only"
                />
                <Label
                  htmlFor={tier}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 rounded-xl border cursor-pointer transition-all duration-200",
                    "border-white/10 bg-white/10 hover:bg-white/15",
                    isSelected &&
                      "border-primary bg-primary/10 shadow-[0_0_20px_rgba(0,229,255,0.3)]",
                    !canAfford && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <RadioGroupItem
                      value={tier}
                      id={`${tier}-visual`}
                      disabled={!canAfford}
                      className="pointer-events-none"
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                    <span className="font-medium">{info.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">{info.tagline}</p>
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      </div>

      {/* Version exists warning */}
      {versionExists && (
        <p className="text-sm text-muted-foreground">
          Note: A {TIER_DISPLAY_INFO[selectedTier].name} version already exists. Creating another
          will use additional credits.
        </p>
      )}

      {/* Action buttons - different layout for dialog vs card */}
      {trigger ? // Dialog mode - buttons in footer
      null : (
        // Card mode - single button
        <Button
          onClick={handleEnhance}
          disabled={isProcessing || !hasEnoughTokens}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enhancing...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Start Enhancement ({TIER_DISPLAY_INFO[selectedTier].cost} credits)
            </>
          )}
        </Button>
      )}
    </div>
  );

  // Dialog mode - render with Dialog wrapper
  if (trigger) {
    return (
      <Dialog
        {...(open !== undefined ? { open } : {})}
        {...(onOpenChange !== undefined ? { onOpenChange } : {})}
      >
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Enhancement Settings</DialogTitle>
          </DialogHeader>
          {content}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancel} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleEnhance} disabled={isProcessing || !hasEnoughTokens}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enhancing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Start Enhancement
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Card mode - render with optional Card wrapper
  if (!asCard) {
    return (
      <div>
        <h3 className="text-sm font-medium mb-3">Enhancement Settings</h3>
        {content}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enhancement Settings</CardTitle>
        <CardDescription>Choose the quality tier for AI enhancement</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
