export type Role = "user" | "system" | "assistant";

export enum MessageType {
  TEXT = "text",
  COMMAND = "command",
  STATUS = "status",
  ERROR = "error",
}

export interface TextPart {
  type: "text";
  text: string;
}

export interface ImageUrlPart {
  type: "image_url";
  image_url: {
    url: string;
  };
}

export interface ImagePart {
  type: "image";
  source: {
    type: string;
    mediaType: string;
    data: string;
  };
}

export type MessagePart = TextPart | ImageUrlPart | ImagePart;
export type MessageContent = string | MessagePart[];

export interface Message {
  id: string;
  role: Role;
  type?: MessageType;
  content: MessageContent;
}

export interface ICodeSession {
  code: string;
  codeSpace: string;
  html: string;
  css: string;
  transpiled: string;
  hash?: string;
  requiresReRender?: boolean;
  appId?: string;
  messages: Message[];
}

export interface CodeVersion {
  number: number;
  code: string;
  transpiled: string;
  html: string;
  css: string;
  hash: string;
  createdAt: number; // Unix timestamp
}
