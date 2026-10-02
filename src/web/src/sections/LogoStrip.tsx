import { ecosystemRowA, ecosystemRowB } from "../data/content";

// Folio "trusted by" strip, reused as a two-row marquee of the real projects
// and frameworks the engine is built on or works with (text wordmarks only).
function Row({ items, reverse }: { items: string[]; reverse?: boolean }) {
  const loop = [...items, ...items];
  return (
    <div className="mask-fade-x overflow-hidden">
      <div className={`flex w-max items-center gap-16 ${reverse ? "animate-marquee-rev" : "animate-marquee"}`}>
        {loop.map((name, i) => (
          <span
            key={`${name}-${i}`}
            className="whitespace-nowrap text-2xl font-semibold tracking-tight text-foreground/45 md:text-[28px]"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function LogoStrip() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-6">
        <p className="mb-8 text-center text-sm font-medium uppercase tracking-wider text-muted">
          Built on and works with
        </p>
        <div className="space-y-8">
          <Row items={ecosystemRowA} />
          <Row items={ecosystemRowB} reverse />
        </div>
      </div>
    </section>
  );
}
