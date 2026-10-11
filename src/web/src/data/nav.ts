import {
  ChatRoundDots,
  CodeSquare,
  CpuBolt,
  DocumentText,
  Documents,
  Global,
  Laptop,
  Letter,
  PlugCircleLine,
  RefreshCircle,
  Scale,
  ShieldCheck,
  Target,
  type IconComponent,
} from "@/components/ui/solar-icons";
import { AEVRIN_MCP_URL, AEVRIN_URL, DEMO_URL, DOCS_URL } from "@/lib/links";

/*
  The navigation menus. Each item is a section of this page (`/#id`) or
  another site (`https://...`). Kept wide and short: two or three columns side
  by side, so the panel stays low.
*/
export type NavItem = { title: string; description: string; href: string; icon: IconComponent };
export type NavColumn = { heading: string; items: NavItem[] };
type NavMenu = { id: string; label: string; columns: NavColumn[] };

export const menus: NavMenu[] = [
  {
    id: "product",
    label: "Product",
    columns: [
      {
        heading: "What it tests",
        items: [
          { title: "Chatbots", description: "Rule breaking and leaks", href: "/#tests", icon: ChatRoundDots },
          { title: "LLM APIs", description: "Hidden instructions spilled", href: "/#tests", icon: CodeSquare },
          { title: "Agents", description: "Tools used the wrong way", href: "/#tests", icon: CpuBolt },
          { title: "RAG pipelines", description: "Poisoned documents", href: "/#tests", icon: Documents },
          { title: "MCP tools", description: "Poisoned tool lists", href: "/#tests", icon: PlugCircleLine },
        ],
      },
      {
        heading: "How it works",
        items: [
          { title: "The campaign file", description: "One small YAML file", href: "/#how-it-works", icon: DocumentText },
          { title: "The judge", description: "Checked on harmless examples first", href: "/#judge", icon: Scale },
          { title: "Replays", description: "A win must happen again", href: "/#replays", icon: RefreshCircle },
          { title: "Your machine", description: "The cloud never attacks", href: "/#local", icon: Laptop },
        ],
      },
      {
        heading: "Findings",
        items: [
          { title: "Proof for every finding", description: "Prompt, reply, and replay", href: "/#findings", icon: ShieldCheck },
          { title: "14 ways to attack", description: "Four families of attacks", href: "/#attacks", icon: Target },
        ],
      },
    ],
  },
  {
    id: "aevrin",
    label: "Aevrin",
    columns: [
      {
        heading: "The platform",
        items: [{ title: "aevrin.net", description: "The Aevrin security platform", href: AEVRIN_URL, icon: Global }],
      },
      {
        heading: "Also from Aevrin",
        items: [{ title: "Aevrin MCP", description: "Security checks for MCP servers", href: AEVRIN_MCP_URL, icon: PlugCircleLine }],
      },
      {
        heading: "Talk to us",
        items: [{ title: "Contact", description: "Questions or a demo", href: DEMO_URL, icon: Letter }],
      },
    ],
  },
];

export const barLinks = [
  { label: "Pricing", href: "/#pricing" },
  { label: "Docs", href: DOCS_URL },
];
