import { Database } from "@/components/ui/solar-icons";
import { WindowFrame } from "./window-frame";
import { WindowSidebar } from "./window-sidebar";
import { WindowFlag } from "./window-flag";

// private records the AI can reach, shown with every value masked
export function CustomerTableWindow() {
  const rows = [
    ["a•••@example.com", "•••• 4242", "team"],
    ["j•••@example.com", "•••• 1881", "free"],
    ["m•••@example.com", "•••• 0937", "team"],
    ["s•••@example.com", "•••• 5510", "free"],
    ["r•••@example.com", "•••• 7264", "scale"],
  ];
  return (
    <WindowFrame title="Customer table (private)" icon={Database}>
      <WindowSidebar items={["customers", "orders", "invoices"]} />
      <div className="flex-1 p-6">
        <div className="flex items-center gap-3">
          <p className="text-[16px] font-semibold">customers</p>
          <span className="ml-auto">
            <WindowFlag tone="bad">private</WindowFlag>
          </span>
        </div>
        <div className="mt-4 grid grid-cols-[1.5fr_1fr_0.7fr] gap-3 px-1 text-[13px] font-medium text-slate-500 dark:text-slate-400">
          <span>email</span>
          <span>card</span>
          <span>plan</span>
        </div>
        <div className="mt-2">
          {rows.map(([email, card, plan]) => (
            <div
              key={email}
              className="grid grid-cols-[1.5fr_1fr_0.7fr] items-center gap-3 border-t border-slate-900/[0.08] px-1 py-2.5 font-mono text-[13px] dark:border-white/[0.08]"
            >
              <span>{email}</span>
              <span className="text-slate-600 dark:text-slate-300">{card}</span>
              <span className="text-slate-600 dark:text-slate-300">{plan}</span>
            </div>
          ))}
        </div>
      </div>
    </WindowFrame>
  );
}
