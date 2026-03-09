import { useEffect } from "react";

export function NotFound() {
  useEffect(() => {
    fetch("/errors/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          service_name: "next-app",
          error_code: "404",
          message: "Missing route",
          metadata: { path: window.location.pathname },
          severity: "warning",
        },
      ]),
    }).catch(console.error);
  }, []);

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>404 - Page Not Found</h1>
      <p>The page you are looking for does not exist or has been moved.</p>
    </div>
  );
}
