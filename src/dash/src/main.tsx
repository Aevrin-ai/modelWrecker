import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { ThemeProvider } from "@/hooks/useTheme";
import { ToastProvider } from "@/hooks/useToast";
import { AuthProvider } from "@/hooks/useAuth";
import { ConfigError } from "@/components/ConfigError";
import { IS_CONFIGURED } from "@/lib/config";
import "./index.css";

// The dashboard is served under /dashboard/ (see vite.config base and public/_redirects).
// A live-API build with missing sign-in settings shows a configuration screen instead of the app.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      {IS_CONFIGURED ? (
        <BrowserRouter basename="/dashboard">
          <ToastProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ToastProvider>
        </BrowserRouter>
      ) : (
        <ConfigError />
      )}
    </ThemeProvider>
  </StrictMode>,
);
