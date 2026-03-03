"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface NetworkRequest {
  id: string;
  method: HttpMethod;
  url: string;
  status: number;
  duration: number;
  size: string;
}

interface NetworkRequestTableProps {
  requests: NetworkRequest[];
}

const methodStyles: Record<HttpMethod, string> = {
  GET: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  POST: "bg-green-500/10 text-green-400 border-green-500/20",
  PUT: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  DELETE: "bg-red-500/10 text-red-400 border-red-500/20",
  PATCH: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

function statusColor(status: number): string {
  if (status >= 500) return "text-red-400";
  if (status >= 400) return "text-orange-400";
  return "text-green-400";
}

export function NetworkRequestTable({ requests }: NetworkRequestTableProps) {
  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800 hover:bg-transparent">
            <TableHead className="text-zinc-500 w-20">Method</TableHead>
            <TableHead className="text-zinc-500">URL</TableHead>
            <TableHead className="text-zinc-500 text-right w-20">Status</TableHead>
            <TableHead className="text-zinc-500 text-right w-24">Duration</TableHead>
            <TableHead className="text-zinc-500 text-right w-20">Size</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map(req => (
            <TableRow key={req.id} className="border-zinc-800 hover:bg-zinc-800/50">
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn("text-xs font-mono", methodStyles[req.method])}
                >
                  {req.method}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-xs text-zinc-300 max-w-xs truncate">
                {req.url}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right font-mono text-sm font-semibold",
                  statusColor(req.status),
                )}
              >
                {req.status}
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-zinc-400">
                {req.duration}ms
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-zinc-400">
                {req.size}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
