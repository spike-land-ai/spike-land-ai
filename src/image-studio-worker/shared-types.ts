// ─── Gallery Types ───

export interface GalleryImage {
  id: string;
  name: string;
  description: string | null;
  url: string;
  thumbnailUrl: string | null;
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
  tags: string[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GalleryAlbum {
  id: string;
  handle: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  privacy: "PUBLIC" | "PRIVATE" | "UNLISTED";
  imageCount: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GalleryPage {
  images: GalleryImage[];
  nextCursor: string | null;
  totalCount?: number;
}

export interface AlbumPage {
  albums: GalleryAlbum[];
}

export interface AlbumDetailPage {
  album: GalleryAlbum;
  images: GalleryImage[];
  nextCursor: string | null;
}

export interface UploadResponse {
  image: GalleryImage;
  album: { id: string; name: string };
}

// ─── Upload Types ───

export interface UploadRequest {
  // Multipart form data fields
  file: File;
  name?: string;
  tags?: string[];
  albumId?: string;
}

// ─── Chat Types ───

export interface ChatMessagePayload {
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface ChatSSEEvent {
  type: "text_delta" | "thought" | "tool_call_start" | "tool_call_end" |
        "browser_command" | "gallery_update" | "system_notice" | "error";
}

export interface TextDeltaEvent extends ChatSSEEvent {
  type: "text_delta";
  text: string;
}

export interface ThoughtEvent extends ChatSSEEvent {
  type: "thought";
  text: string;
}

export interface ToolCallStartEvent extends ChatSSEEvent {
  type: "tool_call_start";
  name: string;
  args: Record<string, unknown>;
}

export interface ToolCallEndEvent extends ChatSSEEvent {
  type: "tool_call_end";
  name: string;
  result: string;
}

export interface BrowserCommandEvent extends ChatSSEEvent {
  type: "browser_command";
  tool: string;
  args: Record<string, unknown>;
  requestId: string;
}

export interface GalleryUpdateEvent extends ChatSSEEvent {
  type: "gallery_update";
  action: "image_created" | "image_enhanced" | "image_deleted" | "album_updated";
  imageId?: string;
  albumId?: string;
}

export interface SystemNoticeEvent extends ChatSSEEvent {
  type: "system_notice";
  text: string;
}

export interface ErrorEvent extends ChatSSEEvent {
  type: "error";
  error: string;
}

export type SSEEventData =
  | TextDeltaEvent
  | ThoughtEvent
  | ToolCallStartEvent
  | ToolCallEndEvent
  | BrowserCommandEvent
  | GalleryUpdateEvent
  | SystemNoticeEvent
  | ErrorEvent;

// ─── Gallery API Request/Response Types ───

export interface CreateAlbumRequest {
  name: string;
  description?: string;
  privacy?: "PUBLIC" | "PRIVATE" | "UNLISTED";
}

export interface AddImagesToAlbumRequest {
  imageIds: string[];
}

export interface GalleryQueryParams {
  cursor?: string;
  limit?: number;
  search?: string;
  tag?: string;
}

// ─── Tool Types ───

export interface ToolInfo {
  name: string;
  description: string;
  category: string;
  tier: string;
  inputSchema?: Record<string, unknown>;
}

export interface ToolCallRequest {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface ToolCallResponse {
  result: {
    content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
    isError?: boolean;
  };
}
