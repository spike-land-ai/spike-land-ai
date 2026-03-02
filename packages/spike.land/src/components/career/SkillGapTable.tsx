import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { SkillGap } from "@/lib/career/types";

interface SkillGapTableProps {
  gaps: SkillGap[];
}

export function SkillGapTable({ gaps }: SkillGapTableProps) {
  const sorted = [...gaps].sort((a, b) => b.gap - a.gap);

  return (
    <div className="max-h-80 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-white/[0.06]">
            <TableHead className="text-zinc-400">Skill</TableHead>
            <TableHead className="text-zinc-400 text-center">Required</TableHead>
            <TableHead className="text-zinc-400 text-center">Yours</TableHead>
            <TableHead className="text-zinc-400 text-center">Gap</TableHead>
            <TableHead className="text-zinc-400">Priority</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((gap) => (
            <TableRow key={gap.skill.uri} className="border-white/[0.04]">
              <TableCell className="text-white text-sm">{gap.skill.title}</TableCell>
              <TableCell className="text-center text-zinc-400">{gap.requiredLevel}</TableCell>
              <TableCell className="text-center text-zinc-400">{gap.userProficiency}</TableCell>
              <TableCell className="text-center text-zinc-400">{gap.gap}</TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={
                    gap.priority === "high"
                      ? "border-red-500/30 text-red-400"
                      : gap.priority === "medium"
                        ? "border-amber-500/30 text-amber-400"
                        : "border-zinc-500/30 text-zinc-400"
                  }
                >
                  {gap.priority}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
