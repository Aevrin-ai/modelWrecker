import { cn } from "@/lib/utils";
import { Documents } from "@/components/ui/solar-icons";
import { WindowFrame } from "./window-frame";
import { PlaceholderBar } from "./placeholder-bar";
import { WindowFlag } from "./window-flag";

// an AI that looks things up in documents before it answers; one has a planted line
export function DocumentSearchWindow() {
  const docs = [
    { name: "refund-policy.pdf", w: "82%" },
    { name: "shipping-faq.md", w: "68%" },
    { name: "partner-notes.docx", w: "74%", planted: true },
  ];
  return (
    <WindowFrame title="Document search" icon={Documents}>
      <div className="flex-1 p-6">
        <div className="rounded-xl bg-slate-100 px-4 py-2.5 text-[14px] text-slate-600 dark:bg-white/10 dark:text-slate-300">
          How long do refunds take?
        </div>
        <p className="mt-5 text-[13px] font-medium text-slate-500 dark:text-slate-400">3 documents found</p>
        <ul className="mt-2 space-y-2.5">
          {docs.map((doc) => (
            <li
              key={doc.name}
              className={cn(
                "rounded-xl border px-4 py-3",
                doc.planted
                  ? "border-amber-200 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-500/10"
                  : "border-slate-900/[0.08] dark:border-white/[0.08]",
              )}
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-[14px]">{doc.name}</span>
                {doc.planted && (
                  <span className="ml-auto">
                    <WindowFlag>hidden instruction</WindowFlag>
                  </span>
                )}
              </div>
              <PlaceholderBar width={doc.w} className="mt-2.5" />
            </li>
          ))}
        </ul>
      </div>
    </WindowFrame>
  );
}
