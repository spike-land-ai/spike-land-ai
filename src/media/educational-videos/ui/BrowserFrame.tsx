import { type FC, type ReactNode } from "react";
import { COLORS } from "../core-logic/constants";

type BrowserFrameProps = {
  children: ReactNode;
  url?: string;
  width?: number | string;
  height?: number | string;
};

export const BrowserFrame: FC<BrowserFrameProps> = ({
  children,
  url = "https://spike.land",
  width = "100%",
  height = "100%",
}) => {
  return (
    <div
      style={{
        width,
        height,
        background: COLORS.darkBg,
        borderRadius: 16,
        border: `1px solid ${COLORS.darkBorder}`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
      }}
    >
      {/* Browser Header */}
      <div
        style={{
          height: 44,
          background: "rgba(255, 255, 255, 0.05)",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 16,
          borderBottom: `1px solid ${COLORS.darkBorder}`,
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#ff5f56",
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#ffbd2e",
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#27c93f",
            }}
          />
        </div>

        {/* URL Bar */}
        <div
          style={{
            flex: 1,
            height: 28,
            background: "rgba(0,0,0,0.3)",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
            fontSize: 12,
            color: COLORS.textSecondary,
            fontFamily: "Inter, sans-serif",
            border: `1px solid ${COLORS.darkBorder}`,
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ marginRight: 8, opacity: 0.5 }}
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          {url}
        </div>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>{children}</div>
    </div>
  );
};
