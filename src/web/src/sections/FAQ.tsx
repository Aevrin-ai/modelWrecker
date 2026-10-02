import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Container } from "../components/Container";
import { Reveal } from "../components/Reveal";
import { faq } from "../data/content";
import { DOCS_URL } from "../data/navigation";
import { cn } from "../lib/cn";

// Folio FAQ: serif title + description, a sticky category nav on the left, and
// grouped accordions on the right. The open item becomes a bordered card.
export function FAQ() {
  const [open, setOpen] = useState<string>(faq.groups[0].items[0].q);
  const [activeGroup, setActiveGroup] = useState(faq.groups[0].id);

  useEffect(() => {
    const els = faq.groups.map((g) => document.getElementById(`faq-${g.id}`)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveGroup(visible[0].target.id.replace("faq-", ""));
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <section id="faq" className="scroll-mt-24 bg-background py-16 md:py-24">
      <Container>
        <div className="grid gap-6 md:grid-cols-2 md:items-end md:gap-12">
          <Reveal>
            <h2 className="h-section text-4xl md:text-5xl">{faq.title}</h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="max-w-md text-balance text-lg text-muted">
              {faq.description}{" "}
              <a href={DOCS_URL} target="_blank" rel="noreferrer noopener" className="font-semibold text-foreground hover:underline">
                {faq.linkLabel}
              </a>
              .
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-8 md:mt-16 md:grid-cols-5 md:gap-12">
          <nav className="h-fit md:sticky md:top-28 md:col-span-2">
            <ul className="flex gap-6 overflow-x-auto md:flex-col md:gap-4">
              {faq.groups.map((g) => (
                <li key={g.id}>
                  <a
                    href={`#faq-${g.id}`}
                    className={cn(
                      "whitespace-nowrap transition-colors",
                      activeGroup === g.id ? "font-medium text-foreground" : "text-muted hover:text-foreground"
                    )}
                  >
                    {g.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-12 md:col-span-3">
            {faq.groups.map((g) => (
              <div key={g.id} id={`faq-${g.id}`} className="scroll-mt-28">
                <h3 className="mb-4 text-xl font-semibold">{g.label}</h3>
                <div>
                  {g.items.map((it) => {
                    const isOpen = open === it.q;
                    return (
                      <div
                        key={it.q}
                        className={cn(
                          "transition-colors",
                          isOpen ? "rounded-xl border border-border bg-card px-6" : "border-b border-border px-6"
                        )}
                      >
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() => setOpen(isOpen ? "" : it.q)}
                          className="flex w-full items-center justify-between gap-4 py-5 text-left text-[17px]"
                        >
                          {it.q}
                          <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", isOpen && "rotate-180")} />
                        </button>
                        <div
                          className={cn(
                            "grid transition-[grid-template-rows] duration-300",
                            isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                          )}
                        >
                          <p className="overflow-hidden text-[17px] leading-relaxed text-muted">
                            <span className="block pb-6">{it.a}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
