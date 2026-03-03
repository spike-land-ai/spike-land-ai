import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { LightboxProvider } from "./contexts/LightboxContext";
import { Toaster } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./main.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LightboxProvider>
          <Toaster position="bottom-right" richColors theme="dark" />
          <App />
        </LightboxProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
