import { Container } from "../components/Container";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal } from "../components/Reveal";
import { principles } from "../data/content";

// Folio testimonial masonry, used for the engine's documented security
// principles instead of invented customer quotes.
export function Principles() {
  return (
    <section className="py-20 md:py-28">
      <Container>
        <SectionHeader title={principles.title} description={principles.description} />
        <div className="mt-12 columns-1 gap-6 md:mt-16 md:columns-2 lg:columns-4">
          {principles.cards.map((c, i) => (
            <Reveal key={c.title} delay={(i % 4) * 0.05} className="mb-6 break-inside-avoid">
              <div className="rounded-2xl border border-border bg-background p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white">
                    <img src="/aevrin-logo.png" alt="" className="h-5 w-auto" />
                  </span>
                  <span>
                    <span className="block font-semibold">{c.title}</span>
                    <span className="block text-sm text-muted">{c.tag} · ModelWrecker</span>
                  </span>
                </div>
                <p className="mt-4 leading-relaxed text-muted">{c.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
