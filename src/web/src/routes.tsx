import { lazy } from "react";
import { Route, Routes } from "react-router";

import { Layout } from "./layout";
import { Home } from "./pages/home";

// home is eager so the hero paints at once; every other page loads on demand
const NotFound = lazy(() => import("./pages/not-found"));

// the browser (main.tsx) and the build-time prerender (entry-prerender.tsx) both render this, so they never disagree
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
