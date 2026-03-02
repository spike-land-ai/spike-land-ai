"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AlertTriangle, Coins } from "lucide-react";

export type EnhancementTierType = "TIER_1K" | "TIER_2K" | "TIER_4K";

interface TierSelectionCheckboxesProps {
  selectedTiers: EnhancementTierType[];
  onSelectionChange: (tiers: EnhancementTierType[]) => void;
  userBalance: number;
  disabled?: boolean;
}

const TIER_INFO: Record<EnhancementTierType, { name: string; resolution: string; cost: number }> = {
  TIER_1K: { name: "1K", resolution: "1024px", cost: 2 },
  TIER_2K: { name: "2K", resolution: "2048px", cost: 5 },
  TIER_4K: { name: "4K", resolution: "4096px", cost: 10 },
};

const TIER_ORDER: EnhancementTierType[] = ["TIER_1K", "TIER_2K", "TIER_4K"];

export function TierSelectionCheckboxes({
  selectedTiers,
  onSelectionChange,
  userBalance,
  disabled = false,
}: TierSelectionCheckboxesProps) {
  const totalCost = selectedTiers.reduce((sum, tier) => sum + TIER_INFO[tier].cost, 0);
  const exceedsBalance = totalCost > userBalance;

  const handleTierToggle = (tier: EnhancementTierType, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedTiers, tier]);
    } else {
      onSelectionChange(selectedTiers.filter((t) => t !== tier));
    }
  };

  const canAffordTier = (tier: EnhancementTierType): boolean => {
    const tierCost = TIER_INFO[tier].cost;
    const isSelected = selectedTiers.includes(tier);

    if (isSelected) {
      return true;
    }

    const newTotal = totalCost + tierCost;
    return newTotal <= userBalance;
  };

  return (
    <div className="space-y-4" data-testid="tier-selection-checkboxes">
      <div className="space-y-3">
        {TIER_ORDER.map((tier) => {
          const info = TIER_INFO[tier];
          const isSelected = selectedTiers.includes(tier);
          const canAfford = canAffordTier(tier);
          const isDisabled = disabled || (!isSelected && !canAfford);

          return (
            <div
              key={tier}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border transition-colors",
                isSelected && "border-primary bg-primary/5",
                !isSelected && "border-border",
                isDisabled && "opacity-50",
              )}
              data-testid={`tier-row-${tier}`}
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  id={`tier-checkbox-${tier}`}
                  checked={isSelected}
                  onCheckedChange={(checked) => handleTierToggle(tier, checked === true)}
                  disabled={isDisabled}
                  data-testid={`tier-checkbox-${tier}`}
                />
                <Label
                  htmlFor={`tier-checkbox-${tier}`}
                  className={cn("flex flex-col cursor-pointer", isDisabled && "cursor-not-allowed")}
                >
                  <span className="font-medium">{info.name}</span>
                  <span className="text-xs text-muted-foreground">{info.resolution}</span>
                </Label>
              </div>

              <div className="flex items-center gap-1.5">
                <Coins className="h-4 w-4 text-yellow-500" />
                <span
                  className={cn(
                    "text-sm font-medium",
                    !canAfford && !isSelected && "text-destructive",
                  )}
                >
                  {info.cost}
                </span>
                {!canAfford && !isSelected && (
                  <span className="text-xs text-destructive">(Insufficient)</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className={cn(
          "flex items-center justify-between p-3 rounded-lg",
          exceedsBalance ? "bg-destructive/10 border border-destructive/20" : "bg-muted/50",
        )}
        data-testid="total-cost-section"
      >
        <div className="flex items-center gap-2">
          {exceedsBalance && (
            <AlertTriangle
              className="h-4 w-4 text-destructive"
              data-testid="balance-warning-icon"
            />
          )}
          <span className="text-sm font-medium">Total Cost</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Coins className="h-4 w-4 text-yellow-500" />
          <span
            className={cn("text-sm font-bold", exceedsBalance && "text-destructive")}
            data-testid="total-cost-value"
          >
            {totalCost}
          </span>
          <span className="text-xs text-muted-foreground">/ {userBalance} available</span>
        </div>
      </div>

      {exceedsBalance && (
        <p
          className="text-xs text-destructive flex items-center gap-1.5"
          data-testid="balance-warning-message"
        >
          <AlertTriangle className="h-3 w-3" />
          Total cost exceeds your available balance
        </p>
      )}
    </div>
  );
}
