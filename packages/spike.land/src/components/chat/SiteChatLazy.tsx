"use client";

import dynamic from "next/dynamic";

const SiteChat = dynamic(() => import("@/components/chat/SiteChat").then((mod) => mod.SiteChat), {
  ssr: false,
});

export function SiteChatLazy() {
  return <SiteChat />;
}
