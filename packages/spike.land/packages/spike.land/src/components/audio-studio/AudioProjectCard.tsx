"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Clock, Layers } from "lucide-react";

type AudioProjectStatus = "active" | "archived" | "draft";

interface AudioProjectCardProps {
  projectName: string;
  trackCount: number;
  duration: string;
  lastModified: string;
  status: AudioProjectStatus;
}

const statusStyles: Record<AudioProjectStatus, string> = {
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  archived: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  draft: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

export function AudioProjectCard({
  projectName,
  trackCount,
  duration,
  lastModified,
  status,
}: AudioProjectCardProps) {
  return (
    <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between mb-2">
          <Badge
            variant="outline"
            className={cn("text-xs capitalize", statusStyles[status])}
          >
            {status}
          </Badge>
        </div>
        <CardTitle className="text-lg text-zinc-100">{projectName}</CardTitle>
        <CardDescription className="text-zinc-400">
          Last modified {lastModified}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm text-zinc-500">
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{trackCount} track{trackCount !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{duration}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
