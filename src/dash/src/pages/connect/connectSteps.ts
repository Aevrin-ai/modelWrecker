// copied from docs/deployment/docker.md and docs/reference/CLI.md; the dashboard only shows them, it never runs them
export const STEPS: {
  title: string;
  body: string;
  commands?: { label?: string; command: string }[];
}[] = [
  {
    title: "Install Docker",
    body: "Install Docker Desktop (macOS, Windows) or Docker Engine with the compose plugin (Linux). The engine image runs as a non-root user with a read-only root filesystem.",
  },
  {
    title: "Get the ModelWrecker engine",
    body: "Clone the repository and create your local environment file. Provider keys stay in .env on your machine; they never reach Aevrin.",
    commands: [
      { command: "git clone https://github.com/Aevrin-ai/modelWrecker.git && cd modelWrecker" },
      { label: "then set the provider key your config names", command: "cp .env.example .env" },
    ],
  },
  {
    title: "Add a campaign config",
    body: "Campaign YAML is mounted read-only into the container. Start from an example and point it at a target you are authorized to test.",
    commands: [{ command: "mkdir config runs" }, { command: "cp examples/openrouter.yaml config/campaign.yaml" }],
  },
  {
    title: "Build and check the engine",
    body: "Build the image once, then validate the config. Validation also checks that the target is marked as authorized.",
    commands: [
      { command: "docker compose build" },
      { command: "docker compose run --rm modelwrecker validate /config/campaign.yaml" },
    ],
  },
  {
    title: "Run a campaign locally",
    body: "All attacks, model calls, and judging run inside the container on your machine. Results land in ./runs.",
    commands: [
      { command: "docker compose run --rm modelwrecker run /config/campaign.yaml" },
      { label: "build the ASR report and leaderboard", command: "docker compose run --rm modelwrecker analyze /work/runs/<run-id>" },
    ],
  },
];
