import { Button } from "@/components/ui/button";
import { Compass, LogIn } from "lucide-react";
import usePlatformCtas from "./usePlatformCtas";

export default function LearnMoreCta({ c }) {
  const { user, startTour, signIn } = usePlatformCtas();

  return (
    <section className="mx-auto max-w-7xl px-6 py-14 md:py-16">
      <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-600 to-indigo-600 px-6 py-12 text-center shadow-lg md:px-14 md:py-16">
        <h2 className="mx-auto max-w-2xl text-2xl font-bold leading-tight text-white md:text-4xl">
          {c.title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-blue-50">
          {c.subtitle}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" onClick={startTour} className="bg-white text-blue-700 hover:bg-blue-50">
            <Compass className="h-4 w-4" aria-hidden="true" />
            {c.primary}
          </Button>
          {!user && (
            <Button
              size="lg"
              variant="outline"
              onClick={signIn}
              className="border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              {c.secondary}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}