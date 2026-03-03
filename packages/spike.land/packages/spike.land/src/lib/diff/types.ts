export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[]; // Lines prefixed with ' ', '+', or '-'
}

export interface FileDiff {
  path: string;
  type: "modified" | "added" | "deleted" | "renamed";
  oldPath?: string;
  hunks: DiffHunk[];
}

export interface Changeset {
  id: string;
  userId: string;
  description: string;
  files: FileDiff[];
  createdAt: string;
}

export interface MergeResult {
  id: string;
  baseChangesetIds: string[];
  files: Array<{
    path: string;
    content: string;
    hasConflicts: boolean;
    conflicts?: Array<{
      line: number;
      ours: string;
      theirs: string;
      base?: string;
    }>;
  }>;
  status: "pending" | "merged" | "conflicted";
}
