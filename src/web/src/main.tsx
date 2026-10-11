import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import "./index.css";
import { AppRoutes } from "./routes";

/*
  The home page arrives prerendered (scripts/prerender.mjs), so its hero paints
  before any script runs; here React takes over that HTML. Cloudflare Pages
  serves the same file for any unknown path, so anywhere else the prerendered
  home is thrown away and the right page renders fresh.
*/
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
