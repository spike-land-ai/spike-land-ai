"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Box, BoxStatus, BoxTier } from "@prisma/client";
import { BoxActionType } from "@prisma/client";
import { Copy, Monitor, Play, RefreshCw, Square, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type BoxWithTier = Box & { tier: BoxTier; };

interface BoxCardProps {
  box: BoxWithTier;
}

export function BoxCard({ box }: BoxCardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = async (action: BoxActionType) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/boxes/${box.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) throw new Error("Action failed");

      toast.success(`Box ${action.toLowerCase()} initiated`);
      router.refresh();
    } catch (error) {
      toast.error("Failed to perform action");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this box?")) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/boxes/${box.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Delete failed");

      toast.success("Box deleted");
      router.refresh();
    } catch (_error) {
      toast.error("Failed to delete box");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClone = async () => {
    const newName = prompt(
      `Enter name for clone of ${box.name}:`,
      `Clone of ${box.name}`,
    );
    if (newName === null) return; // Cancelled

    setIsLoading(true);
    try {
      const res = await fetch(`/api/boxes/${box.id}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Clone failed");
      }

      toast.success("Box cloned successfully");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to clone box",
      );
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: BoxStatus) => {
    switch (status) {
      case "RUNNING":
        return "default";
      case "STOPPED":
        return "secondary";
      case "STARTING":
        return "outline"; // Blue-ish usually or outline
      case "STOPPING":
        return "destructive";
      case "TERMINATED":
        return "destructive";
      case "ERROR":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-xl flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            {box.name}
          </CardTitle>
          <Badge variant={getStatusColor(box.status)}>{box.status}</Badge>
        </div>
        <CardDescription>
          {box.tier.name} Tier • {box.tier.cpu} vCPU • {box.tier.ram / 1024}GB RAM
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="text-sm text-muted-foreground">
          Storage: {box.tier.storage}GB <br />
          Cost: {box.tier.pricePerHour} tokens/hour
        </div>
        {box.connectionUrl && box.status === "RUNNING" && (
          <div className="mt-4">
            <a
              href={box.connectionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Connect via VNC
            </a>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex gap-2 justify-between">
        {box.status === "STOPPED" && (
          <Button
            size="sm"
            variant="default"
            onClick={() => handleAction(BoxActionType.START)}
            disabled={isLoading}
          >
            <Play className="mr-2 h-4 w-4" /> Start
          </Button>
        )}
        {box.status === "RUNNING" && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleAction(BoxActionType.STOP)}
            disabled={isLoading}
          >
            <Square className="mr-2 h-4 w-4" /> Stop
          </Button>
        )}
        {(box.status === "STARTING" || box.status === "STOPPING") && (
          <Button size="sm" variant="outline" disabled>
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Processing
          </Button>
        )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={handleClone}
                disabled={isLoading}
                aria-label="Clone box"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Clone Box</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive/90"
                onClick={handleDelete}
                disabled={isLoading}
                aria-label="Delete box"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Delete Box</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardFooter>
    </Card>
  );
}
