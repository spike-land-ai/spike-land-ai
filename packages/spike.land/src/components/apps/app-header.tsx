"use client";

import { STORE_APPS } from "@/app/store/data/store-apps";
import { Button } from "@/components/ui/button";
import { getStoreIcon } from "@/app/store/components/store-icon-map";
import { ArrowLeft, Info } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function AppHeader() {
  const pathname = usePathname();

  // Find the current app based on the URL
  const currentApp = STORE_APPS.find(
    (app) => app.appUrl && pathname.startsWith(app.appUrl) && app.appUrl !== "/apps",
  );

  if (!currentApp) {
    return null;
  }

  const Icon = getStoreIcon(currentApp.icon);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-zinc-950/80 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="gap-2 text-zinc-400 hover:text-white"
          >
            <Link href="/store">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline-block">Store</span>
            </Link>
          </Button>
        </div>

        <div className="flex flex-1 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold leading-none text-white">{currentApp.name}</h1>
                {currentApp.isCodespaceNative && (
                  <span className="text-[8px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-black uppercase tracking-widest border border-emerald-500/20">
                    AI Native
                  </span>
                )}
              </div>
              <span className="text-xs text-zinc-400 hidden sm:inline-block line-clamp-1 max-w-[200px] mt-0.5">
                {currentApp.tagline}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                    className="h-8 w-8 text-zinc-400 hover:text-white"
                  >
                    <Link href={`/store/${currentApp.slug}`}>
                      <Info className="h-4 w-4" />
                      <span className="sr-only">App Info</span>
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>App Info & Details</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </header>
  );
}
