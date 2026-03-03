export function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-/]/g, "");
}

export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "") // code blocks
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1") // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/#{1,6}\s+/g, "") // headings
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/\*(.+?)\*/g, "$1") // italic
    .replace(/~~(.+?)~~/g, "$1") // strikethrough
    .replace(/---+/g, "") // horizontal rules
    .replace(/>\s+/g, "") // blockquotes
    .replace(/[-*+]\s+/g, "") // unordered lists
    .replace(/\d+\.\s+/g, "") // ordered lists
    .replace(/\n{2,}/g, " ") // multiple newlines
    .replace(/\n/g, " ") // remaining newlines
    .trim();
}
