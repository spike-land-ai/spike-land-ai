interface Props {
  text: string;
  onRefClick: (ref: number) => void;
  isCalling: boolean;
}

export function NarrationPanel({ text, onRefClick, isCalling }: Props) {
  const renderText = () => {
    if (!text)
      return (
        <div className="text-muted-foreground italic flex h-full items-center justify-center">
          No narration available. Enter a URL and click Go.
        </div>
      );

    // Regex to match [role name ref=N] where 'name' could contain brackets or quotes.
    // simpler match: anything inside brackets that ends with ref=\d+
    const parts = text.split(/(\[[^\]]+ref=\d+\])/g);

    return parts.map((part, index) => {
      const match = part.match(/\[(.*?)ref=(\d+)\]/);
      if (match) {
        const [, content = "", refId = "0"] = match;
        return (
          <button
            key={index}
            onClick={() => onRefClick(parseInt(refId, 10))}
            disabled={isCalling}
            className="inline-block px-1.5 py-0.5 mx-0.5 my-1 text-xs font-mono bg-info/15 text-info-foreground border border-info/25 rounded hover:bg-info/25 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title={`Click element #${refId}`}
          >
            {content?.trim()} <span className="opacity-50 text-[10px] ml-1">#{refId}</span>
          </button>
        );
      }
      return (
        <span key={index} className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
          {part}
        </span>
      );
    });
  };

  return (
    <div className={`h-full overflow-auto p-6 bg-background ${isCalling ? "opacity-70" : ""}`}>
      {renderText()}
    </div>
  );
}
