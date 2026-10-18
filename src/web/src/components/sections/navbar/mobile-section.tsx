import { useState } from "react";

import { cn } from "@/lib/utils";
import type { NavColumn } from "@/data/nav";
import { AltArrowRightLine } from "@/components/ui/solar-icons";
import { MenuColumns } from "./menu-columns";

export interface MobileSectionProps {
  label: string;
  columns: NavColumn[];
  onDone: () => void;
}

// one menu on a phone: a row that opens in place, so the phone menu stays short
export function MobileSection({ label, columns, onDone }: MobileSectionProps) {
  const [open, setOpen] = useState(false);
  const id = `nav-mobile-${label.toLowerCase()}`;
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className="text-foreground focus-visible:ring-ring flex min-h-12 w-full items-center justify-between rounded-lg px-1 text-base font-medium outline-none focus-visible:ring-2"
      >
        {label}
        <AltArrowRightLine className={cn("size-4 transition-transform duration-200", open && "rotate-90")} />
      </button>
      <div
        id={id}
        inert={!open}
        className="grid transition-[grid-template-rows,opacity] duration-200 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-1 pb-3">
            <MenuColumns columns={columns} onDone={onDone} stacked />
          </div>
        </div>
      </div>
    </div>
  );
}
