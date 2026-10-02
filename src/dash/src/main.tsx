import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { ThemeProvider } from "@/hooks/useTheme";
import { ToastProvider } from "@/hooks/useToast";
import { AuthProvider } from "@/hooks/useAuth";
import { ConfigError } from "@/components/ConfigError";
import { IS_ADMIN_APP, IS_CONFIGURED } from "@/lib/config";
import "./index.css";

// The dashboard is served under /dashboard/ (see vite.config base and deploy/cloudflare/pages/_worker.js).
// The same build serves the staff admin console under /admin/; its code is a separate chunk that loads
// only there. A live-API build with missing sign-in settings shows a configuration screen instead.
const AdminApp = lazy(() => import("@/admin/AdminApp").then((m) => ({ default: m.AdminApp })));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      {IS_CONFIGURED ? (
        <BrowserRouter basename={IS_ADMIN_APP ? "/admin" : "/dashboard"}>
          <ToastProvider>
            <AuthProvider>
              {IS_ADMIN_APP ? (
                <Suspense fallback={null}>
                  <AdminApp />
                </Suspense>
              ) : (
                <App />
              )}
            </AuthProvider>
          </ToastProvider>
        </BrowserRouter>
      ) : (
        <ConfigError />
      )}
    </ThemeProvider>
  </StrictMode>,
);
