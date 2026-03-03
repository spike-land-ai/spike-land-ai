"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ContentEditorPreviewProps {
  title: string;
  content: string;
  wordCount?: number;
}

export function ContentEditorPreview({
  title,
  content,
  wordCount,
}: ContentEditorPreviewProps) {
  const paragraphs = content.split("\n").filter(p => p.trim().length > 0);

  return (
    <Card className="bg-zinc-900 border-zinc-800 w-full">
      <CardHeader className="pb-4 border-b border-zinc-800">
        <CardTitle className="text-2xl text-zinc-100 font-bold leading-tight">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {paragraphs.map((paragraph, index) => (
          <p
            key={index}
            className="text-zinc-300 leading-7 text-base"
          >
            {paragraph}
          </p>
        ))}
        {wordCount !== undefined && (
          <div className="pt-4 border-t border-zinc-800">
            <span className="text-xs text-zinc-500">
              {wordCount.toLocaleString()} words
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
