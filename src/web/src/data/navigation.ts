// Navigation + global links. Only real destinations: in-page anchors, the
// dashboard (served at /dashboard/), and the real source repository.

export const DASHBOARD_URL = "/dashboard/";
export const GITHUB_URL = "https://github.com/spacesdrive/modelWrecker";
export const DOCS_URL = "https://github.com/spacesdrive/modelWrecker/tree/main/docs";

export const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Engine", href: "#engine" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
] as const;
