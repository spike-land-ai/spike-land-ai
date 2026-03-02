import type {
  DeleteFileResult,
  ListFilesResult,
  ReadFileResult,
  Tool,
  WriteFileResult,
} from "../types";

const MAX_FILE_SIZE = 1024 * 1024; // 1 MB
const MAX_FILE_COUNT = 100;
const ENTRY_POINT = "/src/App.tsx";

export const listFilesTool: Tool = {
  name: "list_files",
  description:
    "List all files in the codespace with their sizes. Always includes /src/App.tsx (the entry point synced from session.code).",
  inputSchema: {
    type: "object",
    properties: {
      codeSpace: {
        type: "string",
        description: "The codeSpace identifier",
      },
    },
    required: ["codeSpace"],
  },
};

export const readFileTool: Tool = {
  name: "read_file",
  description:
    "Read a specific file from the codespace filesystem. Returns content with line numbers.",
  inputSchema: {
    type: "object",
    properties: {
      codeSpace: {
        type: "string",
        description: "The codeSpace identifier",
      },
      path: {
        type: "string",
        description: "File path (e.g. /src/utils.tsx). Use list_files to see available files.",
      },
    },
    required: ["codeSpace", "path"],
  },
};

export const writeFileTool: Tool = {
  name: "write_file",
  description:
    "Write or create a file in the codespace. Writing to /src/App.tsx also updates the main session code and triggers transpilation. Max 1MB per file, 100 files per codespace.",
  inputSchema: {
    type: "object",
    properties: {
      codeSpace: {
        type: "string",
        description: "The codeSpace identifier",
      },
      path: {
        type: "string",
        description: "File path (e.g. /src/utils.tsx)",
      },
      content: {
        type: "string",
        description: "File content to write",
      },
    },
    required: ["codeSpace", "path", "content"],
  },
};

export const deleteFileTool: Tool = {
  name: "delete_file",
  description:
    "Delete a file from the codespace. Cannot delete /src/App.tsx (the protected entry point).",
  inputSchema: {
    type: "object",
    properties: {
      codeSpace: {
        type: "string",
        description: "The codeSpace identifier",
      },
      path: {
        type: "string",
        description: "File path to delete",
      },
    },
    required: ["codeSpace", "path"],
  },
};

export const fileTools: Tool[] = [listFilesTool, readFileTool, writeFileTool, deleteFileTool];

/**
 * List all files in the codespace.
 * Always includes /src/App.tsx synced from session.code.
 */
export function executeListFiles(
  files: Map<string, string>,
  sessionCode: string,
  codeSpace: string,
): ListFilesResult {
  // Build merged view: files map + entry point from session
  const merged = new Map(files);
  if (sessionCode) {
    merged.set(ENTRY_POINT, sessionCode);
  }

  const fileEntries = Array.from(merged.entries())
    .map(([path, content]) => ({
      path,
      size: content.length,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  return {
    files: fileEntries,
    totalFiles: fileEntries.length,
    codeSpace,
  };
}

/**
 * Read a specific file. Returns content with line numbers.
 */
export function executeReadFile(
  files: Map<string, string>,
  sessionCode: string,
  codeSpace: string,
  path: string,
): ReadFileResult {
  // Check entry point first (synced from session.code)
  let content: string | undefined;
  if (path === ENTRY_POINT) {
    content = sessionCode;
  } else {
    content = files.get(path);
  }

  if (content === undefined) {
    throw new Error(`File not found: ${path}`);
  }

  // Add line numbers
  const lines = content.split("\n");
  const numberedContent = lines
    .map((line, i) => `${String(i + 1).padStart(4, " ")} | ${line}`)
    .join("\n");

  return {
    path,
    content: numberedContent,
    size: content.length,
    codeSpace,
  };
}

/**
 * Write/create a file in the codespace.
 * If path is /src/App.tsx, also updates session.code and triggers transpilation.
 */
export async function executeWriteFile(
  files: Map<string, string>,
  sessionCode: string,
  codeSpace: string,
  path: string,
  content: string,
  setFile: (path: string, content: string) => Promise<void>,
  fileCount: number,
): Promise<WriteFileResult> {
  // Validate size
  if (content.length > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${content.length} bytes (max ${MAX_FILE_SIZE} bytes)`);
  }

  // Validate count (only for new files)
  const isExisting = files.has(path) || (path === ENTRY_POINT && sessionCode);
  if (!isExisting && fileCount >= MAX_FILE_COUNT) {
    throw new Error(`File limit reached: ${MAX_FILE_COUNT} files maximum per codespace`);
  }

  await setFile(path, content);

  return {
    success: true,
    message:
      path === ENTRY_POINT
        ? `Entry point updated and transpiled (${content.length} chars).`
        : `File written: ${path} (${content.length} chars).`,
    path,
    size: content.length,
    codeSpace,
  };
}

/**
 * Delete a file from the codespace. Refuses to delete the entry point.
 */
export async function executeDeleteFile(
  files: Map<string, string>,
  codeSpace: string,
  path: string,
  deleteFile: (path: string) => Promise<void>,
): Promise<DeleteFileResult> {
  if (path === ENTRY_POINT) {
    throw new Error(
      `Cannot delete ${ENTRY_POINT}: it is the protected entry point. Use write_file to modify it instead.`,
    );
  }

  if (!files.has(path)) {
    throw new Error(`File not found: ${path}`);
  }

  await deleteFile(path);

  return {
    success: true,
    message: `File deleted: ${path}`,
    path,
    codeSpace,
  };
}
