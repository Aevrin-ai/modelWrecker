import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import "./index.css";
import { AppRoutes } from "./routes";

// the home page arrives prerendered, so React hydrates it; any other path throws that HTML away and renders fresh
const root = document.getElementById("root")!;
const app = (
  <StrictMode>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </StrictMode>
);

if (root.hasChildNodes() && window.location.pathname === "/") {
  hydrateRoot(root, app);
} else {
  root.replaceChildren();
  createRoot(root).render(app);
}
