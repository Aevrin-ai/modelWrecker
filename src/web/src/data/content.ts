// All landing-page copy lives here, separate from layout. Every claim maps to
// something documented in docs/ (architecture, attack-engine, targets, judges,
// campaigns, analytics, security, features/harness-integration). No invented
// customers, statistics, or integrations. Prices are not written here: the Pricing
// section reads src/shared/plans.json, the file the checkout charges from.

export const hero = {
  badge: "Local-first AI red teaming",
  title: "Red team your AI before attackers do",
  subtitle:
    "Aevrin safely attacks your LLMs, agents, RAG pipelines, and MCP tools, replays every success to prove it is real, and turns it into a reproducible finding. The heavy work runs on your machine.",
  primaryCta: "Open the app",
  secondaryCta: "View on GitHub",
  captionLead: "Powered by the",
  captionLink: "ModelWrecker engine",
};

// "Built on and works with" strip. Only real, documented integrations and
// frameworks; shown as text wordmarks, not third-party logos.
export const ecosystemRowA = [
  "PyRIT",
  "garak",
  "OpenRouter",
  "Model Context Protocol",
  "Docker",
  "OpenAI-compatible APIs",
];
export const ecosystemRowB = [
  "Claude Code",
  "Codex",
  "OWASP LLM Top 10",
  "OWASP MCP Top 10",
  "MITRE ATLAS",
  "SQLite + JSONL",
];

export const howItWorks = {
  eyebrow: "How it works",
  title: "Everything around an attack, in one engine",
  description:
    "Register an authorized target, let the engine attack and adapt, and get back only what it could prove. Aevrin is more than a jailbreak script.",
  steps: [
    {
      title: "Point it at a target",
      body: "Chat models, tool-using agents, RAG pipelines, or MCP tools. Nothing runs until the target is defined and marked as authorized.",
    },
    {
      title: "Use the tools you trust",
      body: "PyRIT, garak, and first-party strategies run behind one interface. Switch them on per campaign, no glue code needed.",
    },
    {
      title: "Get a verified report",
      body: "Every success is replayed and scored before it becomes a finding, with the prompt, the reply, and the verdict attached.",
    },
  ],
};

export const features = {
  title: "Everything your team needs to break AI safely",
  description:
    "A planner, a judge, a reliability system, and a campaign engine - built as separate parts so each one can be trusted on its own.",
  cards: [
    {
      title: "Campaign engine",
      body: "Run many objectives in parallel with budgets, stop conditions, and bounded retries. One failing objective never takes the run down.",
    },
    {
      title: "Findings you can trust",
      body: "You hear about a weakness only after it reproduces. Lucky one-shots stay logged attempts, never findings.",
    },
    {
      title: "Multi-signal judge",
      body: "Rules, an LLM grader, a PII detector, a secret detector, and a tool-action signal vote together - not one model's opinion.",
    },
    {
      title: "Payload transforms",
      body: "Reversible encodings and chains mutate every payload to find the filter your model forgot.",
    },
    {
      title: "Attack success rate",
      body: "ASR per strategy and objective with Wilson 95% confidence intervals, and a cross-run model leaderboard.",
    },
  ],
};

export const bento = {
  title: "Every layer of the attack, in one engine",
  description:
    "The attacker, the target, and the judge stay separate roles in separate code. That rule is what makes a result worth believing.",
  automations: {
    title: "The adaptive attack loop",
    body: "The planner picks a strategy, the target replies, and the judge grades it. On failure the planner adapts; on success the reliability system replays it until the result is proven.",
  },
  strategies: {
    title: "A deep strategy library",
    body: "First-party strategies plus PyRIT PAIR and TAP and garak probes - pick one, or let the planner choose.",
    items: [
      "direct_jailbreak",
      "prompt_extraction",
      "best_of_n",
      "pyrit_pair",
      "crescendo",
      "many_shot",
      "pyrit_tap",
      "prefill",
      "garak_probe",
    ],
  },
  targets: {
    title: "Attack any AI surface",
    body: "Chat, agent, RAG, and MCP targets. Agent tool calls are observed, never executed, so testing stays safe.",
  },
  harness: {
    title: "Drive it from your agent",
    body: "Run campaigns from Claude Code or Codex through the ModelWrecker MCP server and get the findings back in the chat.",
  },
  evidence: {
    title: "Evidence timeline",
    body: "Every attempt keeps the prompt sent, the model reply, and the verdict, in an append-only log you can replay later.",
  },
};

export const showcase = {
  title: "Why teams test with Aevrin instead of one-off jailbreak scripts",
  description:
    "Scripts find a lucky prompt once. Aevrin plans, adapts, judges with several signals, replays the result, and keeps the evidence on your machine.",
  tabs: [
    { id: "findings", title: "Verified findings", subtitle: "Replayed, scored, and mapped to OWASP" },
    { id: "transcript", title: "Attack transcript", subtitle: "Prompt, reply, and verdict per attempt" },
    { id: "analytics", title: "Analytics", subtitle: "ASR with confidence intervals" },
    { id: "local", title: "Local engine", subtitle: "Heavy work stays on your machine" },
  ],
};

export const principles = {
  title: "Built like a security tool, not a demo",
  description:
    "These are rules the engine is built on, not marketing promises. Each one is written down in the project's security and architecture docs.",
  cards: [
    { title: "Separate roles", tag: "Architecture", body: "The attacker, the target, and the judge are different roles and different code. A result is never graded by the part that produced it." },
    { title: "Verified, not lucky", tag: "Reliability", body: "A success is replayed many times and scored with a Wilson 95% confidence interval. High-variance results are flagged instead of reported." },
    { title: "Authorized targets only", tag: "Guardrails", body: "A target must be defined and marked authorized before any attack runs. The engine does not attack arbitrary third-party systems by default." },
    { title: "Least privilege", tag: "Security", body: "Host-affecting tools such as shell, file write, and arbitrary HTTP are off by default and never reachable from a network surface without auth." },
    { title: "Egress guard", tag: "Security", body: "Outbound attack traffic is blocked from loopback, private ranges, and cloud metadata addresses, and re-checked on every redirect." },
    { title: "Secrets redacted", tag: "Evidence", body: "API keys, auth headers, passwords, and personal data are redacted before anything is written to logs or evidence." },
    { title: "Local by default", tag: "Privacy", body: "Prompts, replies, and detailed evidence stay on your machine. Only summarized metadata syncs to the dashboard unless you opt in." },
    { title: "Untrusted by default", tag: "Threat model", body: "Every target, prompt, response, and dataset is treated as untrusted, because each one can carry injected instructions." },
    { title: "Pluggable, not forked", tag: "Engine", body: "New strategies, targets, judges, and transforms plug in behind interfaces. The CLI, Docker, and MCP all share one engine." },
  ],
};

export const faq = {
  title: "FAQs",
  description: "Everything you need to know about Aevrin. Can't find what you're looking for? Read the",
  linkLabel: "documentation",
  groups: [
    {
      id: "general",
      label: "General",
      items: [
        {
          q: "What is Aevrin?",
          a: "Aevrin is a local-first AI red teaming product. Its ModelWrecker engine safely attacks LLMs, agents, RAG pipelines, and MCP tools to find security weaknesses before real attackers do, and turns each verified weakness into a reproducible finding.",
        },
        {
          q: "What can it test?",
          a: "Chat models behind OpenAI-compatible APIs, tool-using agents, RAG pipelines (indirect prompt injection through documents), and MCP tools (tool poisoning). Findings map to OWASP LLM Top 10, OWASP MCP Top 10, OWASP Agentic (ASI), and MITRE ATLAS.",
        },
        {
          q: "How does it avoid false findings?",
          a: "A success is not a finding until it is verified. The engine replays each success many times, measures the real success rate with a Wilson 95% confidence interval, and only then creates a finding.",
        },
      ],
    },
    {
      id: "privacy",
      label: "Security and privacy",
      items: [
        {
          q: "Where does the attack actually run?",
          a: "On your machine, inside the local engine. Attack generation, model calls, judging, and evidence capture all happen locally. The Aevrin cloud is a thin control plane for sign-in, projects, and the dashboard. It never runs attacks.",
        },
        {
          q: "What leaves my machine?",
          a: "By default only summarized metadata: campaign, run, finding, severity, strategy, target name, model, provider, success rate, and timestamps. Detailed evidence and full transcripts stay local unless you explicitly choose to upload them.",
        },
        {
          q: "Can it attack any system?",
          a: "No. A target has to be defined and marked as authorized before an attack starts, and outbound traffic passes an egress guard that blocks private network and cloud metadata addresses.",
        },
      ],
    },
    {
      id: "setup",
      label: "Setup",
      items: [
        {
          q: "How do I run it?",
          a: "The engine is a Python package with a CLI, and it ships as a non-root Docker image. You describe a campaign in a YAML file and run it with the modelwrecker CLI.",
        },
        {
          q: "Can I use it from Claude Code or Codex?",
          a: "Yes. The ModelWrecker MCP server lets an agentic harness start campaigns and read findings through safe, high-level tools. It calls the same engine as the CLI.",
        },
        {
          q: "Does it work with local models?",
          a: "It talks to any OpenAI-compatible endpoint and is designed to stay usable with free, self-hostable parts. A tested Ollama setup is on the roadmap and not yet verified.",
        },
      ],
    },
  ],
};

export const cta = {
  title: "Find the weakness before someone else does.",
  body: "Point Aevrin at an authorized target, let the engine attack and adapt on your machine, and keep only what it can prove.",
  button: "Get started with Aevrin",
};

export const footer = {
  blurb:
    "Aevrin is the local-first AI red teaming product built on the ModelWrecker engine. It finds AI security weaknesses and proves them before attackers do.",
  columns: [
    {
      title: "Product",
      links: [
        { label: "Features", href: "#features" },
        { label: "How it works", href: "#how-it-works" },
        { label: "Engine", href: "#engine" },
        { label: "Pricing", href: "#pricing" },
        { label: "Dashboard", href: "/dashboard/" },
      ],
    },
    {
      title: "Targets",
      links: [
        { label: "Chat models", href: "#engine" },
        { label: "Agents", href: "#engine" },
        { label: "RAG pipelines", href: "#engine" },
        { label: "MCP tools", href: "#engine" },
      ],
    },
    {
      title: "Engine",
      links: [
        { label: "Strategies", href: "#engine" },
        { label: "Multi-signal judge", href: "#features" },
        { label: "Reliability", href: "#features" },
        { label: "Analytics", href: "#features" },
      ],
    },
    {
      title: "Resources",
      links: [
        { label: "Documentation", href: "https://github.com/spacesdrive/modelWrecker/tree/main/docs", external: true },
        { label: "GitHub", href: "https://github.com/spacesdrive/modelWrecker", external: true },
        { label: "FAQ", href: "#faq" },
        { label: "aevrin.net", href: "https://aevrin.net", external: true },
      ],
    },
  ],
};
