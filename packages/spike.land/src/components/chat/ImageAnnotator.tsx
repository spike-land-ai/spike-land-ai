"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageAnnotatorProps {
  initialImage: string; // base64
  onSave: (annotatedImage: string) => void;
  onCancel: () => void;
}

export function ImageAnnotator({ initialImage, onSave, onCancel }: ImageAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Cache the canvas bounding rect to avoid layout thrashing on every mousemove
  const rectRef = useRef<DOMRect | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = initialImage;
    img.onload = () => {
      // Set canvas size to match image or maintain aspect ratio within container
      const container = containerRef.current;
      if (!container) return;

      const maxWidth = container.clientWidth - 40;
      const maxHeight = container.clientHeight - 80;

      let width = img.width;
      let height = img.height;

      const scale = Math.min(maxWidth / width, maxHeight / height);
      if (scale < 1) {
        width = width * scale;
        height = height * scale;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw original image
      ctx.drawImage(img, 0, 0, width, height);

      // Setup drawing context
      ctx.strokeStyle = "#ef4444"; // Red color for annotation
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      setContext(ctx);
    };
  }, [initialImage]);

  const startDrawing = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (!context || !canvasRef.current) return;

      // Prevent scrolling when touching canvas
      if (e.type.startsWith("touch")) {
        e.preventDefault();
      }

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      rectRef.current = rect;

      const isTouch = "touches" in e;
      const clientX = isTouch
        ? ((e as React.TouchEvent<HTMLCanvasElement>).touches[0]?.clientX ?? 0)
        : (e as React.MouseEvent<HTMLCanvasElement>).clientX;
      const clientY = isTouch
        ? ((e as React.TouchEvent<HTMLCanvasElement>).touches[0]?.clientY ?? 0)
        : (e as React.MouseEvent<HTMLCanvasElement>).clientY;

      const x = clientX - rect.left;
      const y = clientY - rect.top;

      context.beginPath();
      context.moveTo(x, y);
      setIsDrawing(true);
    },
    [context],
  );

  const draw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !context || !canvasRef.current) return;

      if (e.type.startsWith("touch")) {
        e.preventDefault();
      }

      const rect = rectRef.current;
      if (!rect) return;

      const isTouch = "touches" in e;
      const clientX = isTouch
        ? ((e as React.TouchEvent<HTMLCanvasElement>).touches[0]?.clientX ?? 0)
        : (e as React.MouseEvent<HTMLCanvasElement>).clientX;
      const clientY = isTouch
        ? ((e as React.TouchEvent<HTMLCanvasElement>).touches[0]?.clientY ?? 0)
        : (e as React.MouseEvent<HTMLCanvasElement>).clientY;

      const x = clientX - rect.left;
      const y = clientY - rect.top;

      context.lineTo(x, y);
      context.stroke();
    },
    [isDrawing, context],
  );

  const stopDrawing = useCallback(() => {
    if (!context) return;
    context.closePath();
    setIsDrawing(false);
  }, [context]);

  const handleSave = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    onSave(dataUrl);
  };

  // Prevent default touch actions on the main container to stop scrolling while drawing
  useEffect(() => {
    const preventTouch = (e: TouchEvent) => {
      if (e.target === canvasRef.current) {
        e.preventDefault();
      }
    };

    document.addEventListener("touchmove", preventTouch, { passive: false });
    return () => {
      document.removeEventListener("touchmove", preventTouch);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      {/* Header controls */}
      <div className="absolute top-4 right-4 flex gap-2">
        <Button
          variant="secondary"
          onClick={onCancel}
          className="bg-white/10 hover:bg-white/20 text-white"
        >
          <X className="mr-2 h-4 w-4" /> Cancel
        </Button>
        <Button onClick={handleSave} className="bg-amber-500 hover:bg-amber-600 text-black">
          <Check className="mr-2 h-4 w-4" /> Use Screenshot
        </Button>
      </div>

      <div className="text-white mb-4 flex items-center gap-2">
        <span className="text-sm font-medium">Draw on screenshot</span>
        <div className="w-4 h-4 rounded-full bg-red-500" />
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        className="w-full h-full max-h-[80vh] flex items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-zinc-900/50"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="cursor-crosshair shadow-2xl rounded"
          style={{ touchAction: "none" }}
        />
      </div>
    </div>
  );
}
