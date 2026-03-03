import { ThemeCard } from "../shared/ThemeCard";

export function EditorMockup() {
  return (
    <ThemeCard className="p-0 overflow-hidden font-mono text-sm border-0 shadow-2xl bg-[#1e1e1e] text-[#d4d4d4]">
      {/* Window Chrome */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[#252526] border-b border-[#333]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
          <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
        </div>
        <div className="ml-4 text-xs text-gray-400">src/app/page.tsx</div>
      </div>

      {/* Code Content */}
      <div className="p-4 overflow-x-auto">
        <pre className="leading-relaxed">
                    <code>
                        <span className="text-[#569cd6]">export</span> <span className="text-[#569cd6]">default</span> <span className="text-[#569cd6]">function</span> <span className="text-[#dcdcaa]">Home</span>() {'{'}
                        {'\n'}
                        {'  '}<span className="text-[#569cd6]">return</span> (
                        {'\n'}
                        {'    '}<span className="text-[#808080]">&lt;</span><span className="text-[#569cd6]">div</span> <span className="text-[#9cdcfe]">className</span>=<span className="text-[#ce9178]">"min-h-screen"</span><span className="text-[#808080]">&gt;</span>
                        {'\n'}
                        {'      '}<span className="text-[#808080]">&lt;</span><span className="text-[#4ec9b0]">HeroSection</span> /<span className="text-[#808080]">&gt;</span>
                        {'\n'}
                        {'      '}<span className="text-[#808080]">&lt;</span><span className="text-[#4ec9b0]">FeatureGrid</span> /<span className="text-[#808080]">&gt;</span>
                        {'\n'}
                        {'    '}<span className="text-[#808080]">&lt;/</span><span className="text-[#569cd6]">div</span><span className="text-[#808080]">&gt;</span>
                        {'\n'}
                        {'  '});
                        {'\n'}
                        {'}'}
                    </code>
        </pre>
      </div>
    </ThemeCard>
  );
}
