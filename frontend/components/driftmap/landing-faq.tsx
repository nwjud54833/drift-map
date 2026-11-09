import { LANDING_FAQ_ITEMS } from "@/lib/seo/landing-faq";

export function LandingFaq() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="border-b border-white/[0.07] py-20 md:py-28">
      <div className="mx-auto max-w-[900px] px-4 sm:px-6">
        <div className="mb-9">
          <p className="mb-2.5 font-mono text-xs uppercase tracking-[0.14em] text-[#9496A1]">Answers</p>
          <h2 id="faq-heading" className="text-2xl font-semibold tracking-tight text-white sm:text-4xl">Frequently asked questions</h2>
        </div>
        <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
          {LANDING_FAQ_ITEMS.map(({ question, answer }) => (
            <article key={question} className="py-6">
              <h3 className="text-base font-semibold text-white sm:text-lg">{question}</h3>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-[#A6A5B1]">{answer}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
