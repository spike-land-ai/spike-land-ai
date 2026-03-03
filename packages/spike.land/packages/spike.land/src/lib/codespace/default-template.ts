import type { ICodeSession } from "./types";

export const DEFAULT_TEMPLATE: Omit<ICodeSession, "codeSpace"> = {
  code: `export default function LandingPage() {
  const features = [
    { icon: "📷", label: "Photos" },
    { icon: "📁", label: "Files" },
    { icon: "💬", label: "Messages" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f1a 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      position: "relative",
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: "#fff",
    }}>
      {/* Animated gradient waves */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(ellipse at 50% 0%, rgba(0, 229, 255, 0.15) 0%, transparent 60%)",
        animation: "pulse 4s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(ellipse at 80% 80%, rgba(168, 85, 247, 0.1) 0%, transparent 50%)",
        animation: "pulse 5s ease-in-out infinite reverse",
      }} />

      {/* Floating UI elements */}
      <div style={{
        position: "absolute",
        top: "15%",
        left: "10%",
        width: "80px",
        height: "80px",
        borderRadius: "16px",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
        animation: "float 6s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute",
        top: "25%",
        right: "15%",
        width: "60px",
        height: "60px",
        borderRadius: "12px",
        background: "rgba(0,229,255,0.1)",
        border: "1px solid rgba(0,229,255,0.2)",
        animation: "float 8s ease-in-out infinite reverse",
      }} />
      <div style={{
        position: "absolute",
        bottom: "20%",
        left: "20%",
        width: "100px",
        height: "100px",
        borderRadius: "20px",
        background: "rgba(168,85,247,0.08)",
        border: "1px solid rgba(168,85,247,0.15)",
        animation: "float 7s ease-in-out infinite",
      }} />

      {/* Main content */}
      <div style={{
        position: "relative",
        zIndex: 10,
        textAlign: "center",
        maxWidth: "600px",
        padding: "2rem",
      }}>
        <div style={{
          fontSize: "6rem",
          fontWeight: "bold",
          background: "linear-gradient(135deg, #00e5ff, #a855f7)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          marginBottom: "1rem",
          lineHeight: 1,
        }}>
          404
        </div>

        <h1 style={{
          fontSize: "1.5rem",
          fontWeight: 600,
          color: "#fff",
          marginBottom: "1.5rem",
        }}>
          This space is empty... for now
        </h1>

        <div style={{
          background: "rgba(255,255,255,0.05)",
          borderRadius: "16px",
          padding: "1.5rem",
          border: "1px solid rgba(255,255,255,0.1)",
          marginBottom: "2rem",
          backdropFilter: "blur(10px)",
        }}>
          <p style={{ color: "rgba(255,255,255,0.8)", marginBottom: "1rem", fontSize: "1rem" }}>
            Think of this as your personal development server with{" "}
            <span style={{ color: "#00e5ff", fontWeight: 600 }}>zero startup time</span>.
          </p>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem" }}>
            Send photos, files, or messages and watch as an AI agent transforms this empty canvas into your creation.
          </p>
        </div>

        <div style={{
          display: "flex",
          gap: "1rem",
          justifyContent: "center",
          flexWrap: "wrap",
        }}>
          {features.map((item, i) => (
            <div key={i} style={{
              padding: "0.5rem 1rem",
              background: "rgba(0,229,255,0.1)",
              border: "1px solid rgba(0,229,255,0.3)",
              borderRadius: "9999px",
              fontSize: "0.85rem",
              color: "#00e5ff",
              animation: \`fadeIn 0.5s ease-out \${i * 0.1}s both\`,
            }}>
              {item.icon} {item.label}
            </div>
          ))}
        </div>

        <p style={{
          marginTop: "2rem",
          color: "rgba(255,255,255,0.4)",
          fontSize: "0.8rem",
        }}>
          Powered by spike.land
        </p>
      </div>

      <style>{\`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      \`}</style>
    </div>
  );
}`,
  transpiled: "",
  html: "<div></div>",
  css: "",
  requiresReRender: false,
  messages: [],
};
