import { useState } from "react";
import {
  Sparkles,
  Tags,
  Maximize2,
  Scissors,
  FolderOpen,
  GitCompare,
  Copy,
  Check,
} from "lucide-react";

const EXAMPLE_PROMPTS = [
  "A cyberpunk cityscape at sunset with neon reflections",
  "Watercolor painting of a cozy cafe in Paris",
  "Macro photo of dewdrops on a spider web",
  "Isometric 3D render of a tiny Japanese garden",
  "Oil painting of a golden retriever in a meadow",
  "Minimalist geometric poster for a jazz concert",
  "Photorealistic underwater coral reef scene",
  "Fantasy map of a fictional island kingdom",
  "Retro pixel art of a space explorer",
  "Art deco poster for a 1920s grand hotel",
  "Aerial view of lavender fields in Provence",
  "Studio product photo of vintage headphones",
];

const FEATURE_HIGHLIGHTS = [
  {
    icon: Sparkles,
    tool: "img_generate",
    title: "AI Generation",
    description: "Create images from text prompts using state-of-the-art AI models.",
  },
  {
    icon: Tags,
    tool: "img_auto_tag",
    title: "Auto-Tag",
    description: "AI automatically tags and describes your uploads for easy search.",
  },
  {
    icon: Maximize2,
    tool: "img_enhance",
    title: "Smart Enhance",
    description: "Upscale images up to 4K with AI-powered detail enhancement.",
  },
  {
    icon: Scissors,
    tool: "img_remove_bg",
    title: "Background Removal",
    description: "Remove backgrounds instantly with AI precision.",
  },
  {
    icon: FolderOpen,
    tool: "albums_pipelines",
    title: "Albums & Pipelines",
    description: "Organize images into albums and automate your workflow.",
  },
  {
    icon: GitCompare,
    tool: "img_compare",
    title: "AI Compare",
    description: "Compare two images with AI similarity analysis and scoring.",
  },
];

function PromptCard({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3 hover:border-gray-700 transition-colors">
      <p className="text-sm text-gray-300 leading-relaxed flex-1">{prompt}</p>
      <button
        onClick={handleCopy}
        className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-400 hover:text-gray-200 transition-colors"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-green-400" />
            <span className="text-green-400">Copied</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            <span>Try it</span>
          </>
        )}
      </button>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-lg bg-accent-600/20 shrink-0">
          <Icon className="w-5 h-5 text-accent-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-100 mb-1">{title}</h3>
          <p className="text-xs text-gray-400 leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function DemoGallery() {
  return (
    <div className="space-y-10">
      {/* Hero */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Explore what's possible</h1>
        <p className="mt-2 text-gray-400 text-sm">
          Browse example prompts and discover the full range of AI-powered tools available in Pixel
          Studio.
        </p>
      </div>

      {/* Example Prompts */}
      <section>
        <h2 className="text-base font-semibold text-gray-200 mb-4">Example Prompts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <PromptCard key={prompt} prompt={prompt} />
          ))}
        </div>
      </section>

      {/* Feature Highlights */}
      <section>
        <h2 className="text-base font-semibold text-gray-200 mb-4">Feature Highlights</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FEATURE_HIGHLIGHTS.map((feature) => (
            <FeatureCard
              key={feature.tool}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
