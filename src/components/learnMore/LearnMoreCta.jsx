import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";

export default function LearnMoreCta({ c }) {
  return (
    <section className="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-20">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 px-6 py-12 text-center text-white shadow-xl md:px-14 md:py-16">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(50% 60% at 15% 0%, rgba(255,255,255,0.18), transparent 70%)",
          }}
        />
        <div className="relative">
          <h2
            className="mx-auto max-w-2xl text-2xl font-bold leading-tight md:text-4xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {c.title}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-blue-100">
            {c.subtitle}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to={createPageUrl("Home")}>
              <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50">
                {c.primary}
              </Button>
            </Link>
            <Link to={createPageUrl("CreateDocument")}>
              <Button
                size="lg"
                variant="outline"
                className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                {c.secondary}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}