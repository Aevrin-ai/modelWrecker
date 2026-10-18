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

// the admin console is a separate chunk of the same build, loaded only under /admin/
const AdminApp = lazy(() => import("@/admin/AdminApp").then((adminModule) => ({ default: adminModule.AdminApp })));

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
