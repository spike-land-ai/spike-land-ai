"use client";

import dynamic from "next/dynamic";

// ssr:false is only allowed inside Client Components.
// This wrapper owns the dynamic import so the Server Component page can import it safely.
const ReadAloudArticle = dynamic(
  () =>
    import("./ReadAloudArticle").then(mod => ({
      default: mod.ReadAloudArticle,
    })),
  { ssr: false },
);

export { ReadAloudArticle };
