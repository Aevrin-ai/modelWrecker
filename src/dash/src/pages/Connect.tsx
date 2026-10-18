import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CommandBlock } from "@/components/CommandBlock";
import { CloudLocalDiagram, ControlPlaneCallout } from "@/components/LocalBoundary";
import { EngineStatusCard } from "@/components/EngineStatus";
import { STEPS } from "./connect/connectSteps";
import { EngineFactsCard } from "./connect/EngineFactsCard";
import { LinkDeviceStep } from "./connect/LinkDeviceStep";
import { StepNumber } from "./connect/StepNumber";

export function Connect() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Connect ModelWrecker"
        description="Run the engine on your own machine. The dashboard manages and shows results; it never runs attacks."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {STEPS.map((setupStep, i) => (
            <Card key={setupStep.title}>
              <CardContent className="flex gap-4 p-6">
                <StepNumber step={i + 1} />
                <div className="min-w-0 flex-1 space-y-3">
                  <p className="font-semibold">{setupStep.title}</p>
                  <p className="text-sm text-muted-foreground">{setupStep.body}</p>
                  {setupStep.commands?.map((entry) => (
                    <CommandBlock key={entry.command} command={entry.command} label={entry.label} />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          <LinkDeviceStep step={STEPS.length + 1} />
        </div>

        <div className="space-y-4">
          <EngineFactsCard />
          <EngineStatusCard />
          <ControlPlaneCallout />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What stays where</CardTitle>
          <CardDescription>Detailed evidence and transcripts stay local unless you turn on syncing in Settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <CloudLocalDiagram />
        </CardContent>
      </Card>
    </div>
  );
}
