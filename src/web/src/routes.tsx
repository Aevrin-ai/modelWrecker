import { lazy } from "react";
import { Route, Routes } from "react-router";

import { Layout } from "./layout";
import { Home } from "./pages/home";

// Home is eager so the hero paints at once; every other page loads on demand.
const NotFound = lazy(() => import("./pages/not-found"));

// The site's pages. The browser (main.tsx) and the build-time prerender
// (entry-prerender.tsx) both render this, so the two can never disagree.
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
