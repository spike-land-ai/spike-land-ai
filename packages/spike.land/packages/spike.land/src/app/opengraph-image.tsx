import { ImageResponse } from "next/og";
import toolsManifest from "@/lib/docs/generated/tools-manifest.json";

export const runtime = "edge";
export const alt = "spike.land — Lazy-Load MCP Tools. Save Context. Ship Faster.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)",
          padding: "40px",
        }}
      >
        {/* Logo and Title */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "24px",
            marginBottom: "32px",
          }}
        >
          {/* Zap Icon (Spike Land Logo) */}
          <div
            style={{
              display: "flex",
              width: "80px",
              height: "80px",
              position: "relative",
            }}
          >
            <svg
              width="80"
              height="80"
              viewBox="0 0 24 24"
              fill="#fbbf24"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <span
            style={{
              fontSize: "72px",
              fontWeight: "bold",
              color: "white",
              letterSpacing: "-0.02em",
            }}
          >
            spike.land
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            display: "flex",
            fontSize: "36px",
            color: "rgba(255, 255, 255, 0.8)",
            textAlign: "center",
            maxWidth: "900px",
            lineHeight: "1.4",
          }}
        >
          {`${toolsManifest.tools.length}+ MCP Tools. Lazy-Load. Save Context.`}
        </div>
      </div>
    ),
    { ...size },
  );
}
