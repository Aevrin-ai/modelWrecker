import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";

import { AppRoutes } from "./routes";

/*
  Build-time only: renders the home page to HTML so the hero is in the file the
  server sends. Everything below the hero is lazy, so it renders as its
  placeholder here and loads in the browser. See scripts/prerender.mjs.
*/
export function render(url: string) {
  return renderToString(
    <StrictMode>
      <StaticRouter location={url}>
        <AppRoutes />
      </StaticRouter>
    </StrictMode>,
  );
}
