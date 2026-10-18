import { BentoCard, Section, SectionIntro } from "@/components/ui/blocks";
import { AgentPanel, ApiPanel, ChatbotPanel, McpPanel, RagPanel } from "@/components/mockups/tests-panels";

// a bento grid of the five kinds of AI system; the 9/15 row waits for lg, since a 9-column card is too narrow on a tablet
export function Tests() {
  return (
    <Section id="tests" labelledBy="tests-heading">
      <SectionIntro
        id="tests-heading"
        layout="stacked"
        title="Anything you can talk to, it can test."
        titleClassName="max-w-[20ch]"
      />

      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-24 md:gap-5">
        <BentoCard
          className="md:col-span-12"
          scene="sky"
          title="Chatbots"
          description="A chatbot can be talked into breaking its own rules."
        >
          <ChatbotPanel />
        </BentoCard>

        <BentoCard
          className="md:col-span-12"
          delay={0.05}
          scene="mist"
          title="LLM APIs"
          description="An LLM API is an AI model your app calls with code. A crafted message can make it spill its hidden instructions."
        >
          <ApiPanel />
        </BentoCard>

        <BentoCard
          className="md:col-span-12 lg:col-span-9"
          scene="meadow"
          title="Agents"
          description="An agent is an AI that takes actions for you. A trick can make it use a tool it should not."
        >
          <AgentPanel />
        </BentoCard>

        <BentoCard
          className="md:col-span-12 lg:col-span-15"
          delay={0.05}
          scene="dusk"
          title="RAG pipelines"
          description="A RAG pipeline is an AI that looks things up in your documents before it answers. One planted line in a document can steer its answer."
        >
          <RagPanel />
        </BentoCard>

        <BentoCard
          className="md:col-span-24"
          fit
          scene="sky"
          title="MCP tools"
          description="MCP is a way to plug tools into an AI. A poisoned tool description can give the AI secret orders."
        >
          <McpPanel />
        </BentoCard>
      </div>
    </Section>
  );
}
