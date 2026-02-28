"use client";

import {
  type GalleryImage,
  ImageSelectorDialog,
  MixHistory,
  type MixResult,
  type SelectedImage,
} from "@/components/mix";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useMixHistory } from "@/hooks/useMixHistory";
import { useWorkspaceCredits } from "@/hooks/useWorkspaceCredits";
import { ENHANCEMENT_COSTS } from "@/lib/credits/costs";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import type { EnhancementTier } from "@prisma/client";
import { AlertTriangle, ArrowLeft, Coins, Menu, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { BlendrImageSlot } from "./BlendrImageSlot";
import { BlendrResult } from "./BlendrResult";

type SelectorTarget = "image1" | "image2" | null;

interface BlendrClientProps {
  /** Whether the user is anonymous (not logged in) */
  isAnonymous?: boolean;
}

export function BlendrClient({ isAnonymous = false }: BlendrClientProps) {
  const router = useRouter();
  // Only fetch credits for authenticated users
  const {
    remaining,
    isLoading: isBalanceLoading,
    refetch: refetchBalance,
  } = useWorkspaceCredits({
    autoRefreshOnFocus: !isAnonymous,
  });
  // Only fetch history for authenticated users
  const { refetch: refetchHistory } = useMixHistory();

  // Image selection state
  const [image1, setImage1] = useState<SelectedImage | null>(null);
  const [image2, setImage2] = useState<SelectedImage | null>(null);
  const [selectorTarget, setSelectorTarget] = useState<SelectorTarget>(null);

  // Processing state
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isCreatingMix, setIsCreatingMix] = useState(false);
  const [needsUpload, setNeedsUpload] = useState(false);

  // Tier selection - anonymous users are forced to FREE tier
  const [selectedTier, setSelectedTier] = useState<EnhancementTier>("FREE");
  // Force FREE tier for anonymous users
  const effectiveTier = isAnonymous ? "FREE" : selectedTier;
  const tokenCost = ENHANCEMENT_COSTS[effectiveTier];

  const canCreateMix = image1 !== null && image2 !== null && !activeJobId
    && !isCreatingMix;
  const hasEnoughTokens = isAnonymous || tokenCost === 0
    || remaining >= tokenCost;

  // Check if we need to upload images first (both must be gallery images OR we handle uploads)
  const hasUploadedImages = isAnonymous || image1?.type === "upload"
    || image2?.type === "upload";

  const handleImage1Select = useCallback((image: SelectedImage) => {
    setImage1(image);
  }, []);

  const handleImage2Select = useCallback((image: SelectedImage) => {
    setImage2(image);
  }, []);

  const handleOpenGallery = useCallback((target: SelectorTarget) => {
    setSelectorTarget(target);
  }, []);

  const handleSelectorSelect = useCallback(
    (
      selectedImg: {
        id: string;
        url: string;
        name: string;
        width: number;
        height: number;
      },
    ) => {
      const galleryImage: GalleryImage = {
        type: "gallery",
        id: selectedImg.id,
        url: selectedImg.url,
        name: selectedImg.name,
        width: selectedImg.width,
        height: selectedImg.height,
      };

      if (selectorTarget === "image1") {
        handleImage1Select(galleryImage);
      } else if (selectorTarget === "image2") {
        handleImage2Select(galleryImage);
      }
      setSelectorTarget(null);
    },
    [selectorTarget, handleImage1Select, handleImage2Select],
  );

  const uploadImageAndGetId = async (
    image: SelectedImage,
    useAnonymousUpload: boolean,
  ): Promise<string> => {
    if (image.type === "gallery") {
      return image.id;
    }

    const formData = new FormData();
    const byteCharacters = atob(image.base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: image.mimeType });
    const file = new File([blob], image.name, { type: image.mimeType });

    formData.append("file", file);

    const uploadEndpoint = useAnonymousUpload
      ? "/api/images/anonymous-upload"
      : "/api/images/upload";

    const uploadResponse = await fetch(uploadEndpoint, {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json();
      throw new Error(error.error || "Failed to upload image");
    }

    const uploadResult = await uploadResponse.json();
    return uploadResult.image.id;
  };

  const handleCreateMix = useCallback(async () => {
    if (!image1 || !image2) return;

    setIsCreatingMix(true);
    setNeedsUpload(hasUploadedImages);

    try {
      let targetImageId: string;
      let blendSource: { imageId?: string; base64?: string; mimeType?: string; };

      if (image1.type === "upload") {
        targetImageId = await uploadImageAndGetId(image1, isAnonymous);
      } else {
        targetImageId = image1.id;
      }

      if (image2.type === "upload") {
        blendSource = {
          base64: image2.base64,
          mimeType: image2.mimeType,
        };
      } else {
        blendSource = {
          imageId: image2.id,
        };
      }

      setNeedsUpload(false);

      const enhanceEndpoint = isAnonymous
        ? "/api/images/anonymous-enhance"
        : "/api/images/enhance";

      const response = await fetch(enhanceEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageId: targetImageId,
          tier: effectiveTier,
          blendSource,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create mix");
      }

      const result = await response.json();
      setActiveJobId(result.jobId);
      if (!isAnonymous) {
        refetchBalance();
      }
    } catch (error) {
      logger.error("Failed to create mix", error);
      alert(error instanceof Error ? error.message : "Failed to create mix");
    } finally {
      setIsCreatingMix(false);
      setNeedsUpload(false);
    }
  }, [
    image1,
    image2,
    effectiveTier,
    isAnonymous,
    refetchBalance,
    hasUploadedImages,
  ]);

  const handleMixComplete = useCallback(
    (_result: MixResult) => {
      refetchHistory();
      refetchBalance();
    },
    [refetchHistory, refetchBalance],
  );

  const handleMixError = useCallback((error: string) => {
    logger.error("Mix failed", error);
    setActiveJobId(null);
  }, []);

  const handleRetry = useCallback(() => {
    setActiveJobId(null);
    handleCreateMix();
  }, [handleCreateMix]);

  const handleClearImage1 = useCallback(() => {
    if (image1?.type === "upload") {
      URL.revokeObjectURL(image1.url);
    }
    setImage1(null);
  }, [image1]);

  const handleClearImage2 = useCallback(() => {
    if (image2?.type === "upload") {
      URL.revokeObjectURL(image2.url);
    }
    setImage2(null);
  }, [image2]);

  return (
    <div className="min-h-screen bg-[#050510] text-foreground relative overflow-x-hidden pb-48">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[10%] right-[-10%] w-[50%] h-[50%] bg-[#ff00ff]/10 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-4 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          <span className="font-bold text-lg tracking-tight text-white">
            spike.land
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-white/10 rounded-full text-white"
          onClick={() => router.push("/")}
        >
          <Menu className="h-6 w-6" />
        </Button>
      </header>

      <main className="relative z-10 px-4 max-w-md mx-auto space-y-6 pt-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold tracking-tight text-white mb-6">
            Blendr
          </h1>
        </div>

        {/* Inputs */}
        <div className="space-y-4">
          <BlendrImageSlot
            label="Input 1"
            image={image1}
            onImageSelect={handleImage1Select}
            onImageClear={handleClearImage1}
            {...(!isAnonymous ? { onOpenGallery: () => handleOpenGallery("image1") } : {})}
            disabled={activeJobId !== null}
          />
          <BlendrImageSlot
            label="Input 2"
            image={image2}
            onImageSelect={handleImage2Select}
            onImageClear={handleClearImage2}
            {...(!isAnonymous ? { onOpenGallery: () => handleOpenGallery("image2") } : {})}
            disabled={activeJobId !== null}
          />
        </div>

        {/* Tier Selection */}
        {!isAnonymous && (
          <div className="space-y-3 pt-2">
            {/* Free Option */}
            <div
              onClick={() => !activeJobId && setSelectedTier("FREE")}
              onKeyDown={e =>
                (e.key === "Enter" || e.key === " ") && !activeJobId
                && setSelectedTier("FREE")}
              role="button"
              tabIndex={activeJobId ? -1 : 0}
              aria-label="Select FREE: Nano Banana tier"
              aria-pressed={effectiveTier === "FREE"}
              className={cn(
                "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer",
                effectiveTier === "FREE"
                  ? "glass-2 border-primary/50 bg-primary/5"
                  : "glass-1 border-white/5 hover:bg-white/5",
              )}
            >
              <div className="flex items-center gap-3">
                <Switch
                  checked={effectiveTier === "FREE"}
                  onCheckedChange={() => setSelectedTier("FREE")}
                  className="data-[state=checked]:bg-primary"
                />
                <span
                  className={cn(
                    "font-medium text-sm",
                    effectiveTier === "FREE" ? "text-white" : "text-white/60",
                  )}
                >
                  FREE: Nano Banana
                </span>
              </div>
            </div>

            {/* Pro Option */}
            <div
              onClick={() => !activeJobId && setSelectedTier("TIER_1K")}
              onKeyDown={e =>
                (e.key === "Enter" || e.key === " ") && !activeJobId
                && setSelectedTier("TIER_1K")}
              role="button"
              tabIndex={activeJobId ? -1 : 0}
              aria-label="Select Pro tier"
              aria-pressed={effectiveTier === "TIER_1K"}
              className={cn(
                "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer",
                effectiveTier === "TIER_1K"
                  ? "glass-aura-fuchsia border-fuchsia-500/50"
                  : "glass-1 border-white/5 hover:bg-white/5",
              )}
            >
              <div className="flex items-center gap-3">
                <Switch
                  checked={effectiveTier === "TIER_1K"}
                  onCheckedChange={() => setSelectedTier("TIER_1K")}
                  className={cn(
                    "data-[state=checked]:bg-fuchsia-500",
                    effectiveTier === "TIER_1K" && "shadow-glow-fuchsia",
                  )}
                />
                <span
                  className={cn(
                    "font-medium text-sm",
                    effectiveTier === "TIER_1K"
                      ? "text-white"
                      : "text-white/60",
                  )}
                >
                  PRO: Nano Banana Pro (2 tokens)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Balance Warning */}
        {!isAnonymous && !hasEnoughTokens && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>Not enough tokens for Pro</span>
          </div>
        )}

        {/* Action Button */}
        <Button
          size="lg"
          className={cn(
            "w-full h-14 text-lg font-bold rounded-full shadow-lg transition-all duration-300",
            "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500",
            "shadow-glow-cyan hover:shadow-glow-cyan/80 hover:scale-[1.02] active:scale-[0.98]",
            isCreatingMix && "opacity-80 disabled:opacity-80",
            "text-white",
          )}
          onClick={handleCreateMix}
          disabled={!canCreateMix
            || (!isAnonymous && !hasEnoughTokens && effectiveTier !== "FREE")}
        >
          {isCreatingMix
            ? (
              <>
                <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                {needsUpload ? "Uploading..." : "Blending..."}
              </>
            )
            : (
              "Create Blend"
            )}
        </Button>

        {/* Result */}
        <BlendrResult
          activeJobId={activeJobId}
          hasImages={image1 !== null && image2 !== null}
          onComplete={handleMixComplete}
          onError={handleMixError}
          onRetry={handleRetry}
        />
      </main>

      {/* Footer / History Strip */}
      <div className="fixed bottom-0 left-0 right-0 z-20 glass-2 border-t border-white/10 p-2 md:p-4">
        <div className="max-w-md mx-auto flex flex-col gap-3">
          <div className="flex items-center justify-between w-full">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-white/10 text-white"
              onClick={() => router.push("/apps/pixel")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>

            {!isAnonymous && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                <Coins className="h-3.5 w-3.5 text-yellow-500" />
                <span className="text-sm font-medium text-white">
                  {isBalanceLoading ? "..." : remaining} tokens
                </span>
              </div>
            )}
          </div>

          {!isAnonymous && (
            <div className="w-full overflow-hidden">
              <div className="flex gap-2 p-1 overflow-x-auto hide-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <div className="min-w-full">
                  <MixHistory
                    activeMix={activeJobId && image1 && image2
                      ? {
                        id: activeJobId,
                        tier: effectiveTier,
                        status: "PROCESSING",
                        currentStage: null,
                        resultUrl: null,
                        resultWidth: null,
                        resultHeight: null,
                        createdAt: new Date().toISOString(),
                        targetImage: {
                          id: image1.id,
                          name: image1.name,
                          url: image1.url,
                          width: image1.width,
                          height: image1.height,
                        },
                        sourceImage: {
                          id: image2.id,
                          name: image2.name,
                          url: image2.url,
                          width: image2.width,
                          height: image2.height,
                        },
                      }
                      : null}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Image selector dialog - only for authenticated users */}
      {!isAnonymous && (
        <ImageSelectorDialog
          open={selectorTarget !== null}
          onOpenChange={open => !open && setSelectorTarget(null)}
          onSelect={handleSelectorSelect}
          {...(() => {
            const excludeId = selectorTarget === "image1"
              ? image2?.type === "gallery" ? image2.id : undefined
              : image1?.type === "gallery"
              ? image1.id
              : undefined;
            return excludeId !== undefined ? { excludeImageId: excludeId } : {};
          })()}
          title={selectorTarget === "image1"
            ? "Select Input Photo 1"
            : "Select Input Photo 2"}
        />
      )}
    </div>
  );
}
