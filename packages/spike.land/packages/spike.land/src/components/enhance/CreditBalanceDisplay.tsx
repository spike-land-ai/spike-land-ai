"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/components/ui/link";
import { Progress } from "@/components/ui/progress";
import { useWorkspaceCredits } from "@/hooks/useWorkspaceCredits";
import { cn } from "@/lib/utils";
import { AlertTriangle, ImageIcon, Sparkles } from "lucide-react";

interface CreditBalanceDisplayProps {
  showEstimates?: boolean;
  className?: string;
}

export function CreditBalanceDisplay({
  showEstimates = true,
  className,
}: CreditBalanceDisplayProps) {
  const {
    remaining,
    isLoading,
    isLowCredits,
    isCriticalCredits,
    estimatedEnhancements,
    usagePercent,
  } = useWorkspaceCredits();

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center gap-2 p-4">
          <Sparkles className="h-5 w-5 text-muted-foreground animate-pulse" />
          <span className="text-sm text-muted-foreground">
            Loading credits...
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        isCriticalCredits && "border-destructive",
        isLowCredits && !isCriticalCredits && "border-yellow-500",
        className,
      )}
    >
      <CardContent className="p-4 space-y-4">
        {/* Credit Display */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles
              className={cn(
                "h-5 w-5",
                isCriticalCredits
                  ? "text-destructive"
                  : isLowCredits
                  ? "text-yellow-500"
                  : "text-primary",
              )}
            />
            <div>
              <p className="text-sm font-medium">{remaining} credits</p>
              <p className="text-xs text-muted-foreground">Monthly balance</p>
            </div>
          </div>

          {/* Low Credits Warning */}
          {isLowCredits && (
            <div
              className={cn(
                "flex items-center gap-1 text-xs",
                isCriticalCredits ? "text-destructive" : "text-yellow-600",
              )}
              data-testid="low-credits-warning"
            >
              <AlertTriangle className="h-3 w-3" />
              <span>
                {isCriticalCredits ? "Critical" : "Low balance"}
              </span>
            </div>
          )}
        </div>

        {/* Usage Progress */}
        <div className="space-y-1">
          <Progress value={usagePercent} className="h-1" />
          <p className="text-[10px] text-muted-foreground text-right">
            {usagePercent}% used
          </p>
        </div>

        {/* Estimated Enhancements */}
        {showEstimates && (
          <div
            className="bg-muted/50 rounded-lg p-3 space-y-2"
            data-testid="estimated-enhancements"
          >
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ImageIcon className="h-3 w-3" />
              <span>Estimated enhancements</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              <div>
                <p className="font-semibold">{estimatedEnhancements.tier1K}</p>
                <p className="text-muted-foreground">1K</p>
              </div>
              <div>
                <p className="font-semibold">{estimatedEnhancements.tier2K}</p>
                <p className="text-muted-foreground">2K</p>
              </div>
              <div>
                <p className="font-semibold">{estimatedEnhancements.tier4K}</p>
                <p className="text-muted-foreground">4K</p>
              </div>
            </div>
          </div>
        )}

        {/* Purchase CTA for low balance */}
        {isLowCredits && (
          <div className="pt-2" data-testid="purchase-cta">
            <Button
              asChild
              size="sm"
              variant={isCriticalCredits ? "default" : "outline"}
              className="w-full text-xs h-8"
            >
              <Link href="/pricing">
                {isCriticalCredits ? "Upgrade Plan" : "View Plans"}
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
