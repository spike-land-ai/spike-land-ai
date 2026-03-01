"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { Loader2 } from "lucide-react";

mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    securityLevel: "loose",
    state: {
        useMaxWidth: true,
    },
});

interface MermaidViewerProps {
    chart: string;
}

export function MermaidViewer({ chart }: MermaidViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const renderChart = async () => {
            if (!chart || !containerRef.current) return;

            try {
                setError(null);
                // Create a unique ID for this render
                const id = `mermaid-svg-${Math.random().toString(36).substring(2, 9)}`;
                const { svg: renderedSvg } = await mermaid.render(id, chart);

                if (isMounted) {
                    setSvg(renderedSvg);
                }
            } catch (err) {
                if (isMounted) {
                    setError(err instanceof Error ? err.message : "Failed to render diagram");
                    console.error("Mermaid rendering error:", err);
                }
            }
        };

        renderChart();

        return () => {
            isMounted = false;
        };
    }, [chart]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-red-400 bg-red-950/20 rounded-xl border border-red-500/20">
                <p className="text-sm font-semibold mb-2">Failed to render diagram</p>
                <p className="text-xs opacity-70 font-mono text-center overflow-auto max-h-32 max-w-full">{error}</p>
            </div>
        );
    }

    if (!svg) {
        return (
            <div className="flex items-center justify-center h-full text-zinc-500">
                <Loader2 className="w-6 h-6 animate-spin" />
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="mermaid-viewer-container w-full h-full flex items-center justify-center p-4 overflow-auto custom-scrollbar [&>svg]:max-w-full [&>svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
}
