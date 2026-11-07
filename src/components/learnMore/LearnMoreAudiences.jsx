export default function LearnMoreAudiences({ c }) {
  return (
    <section className="border-y border-border bg-slate-50/80">
      <div className="mx-auto max-w-4xl px-5 py-12 text-center md:px-8">
        <h2 className="text-lg font-semibold text-foreground md:text-xl">{c.title}</h2>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          {c.items.map((item) => (
            <span
              key={item}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-slate-700 shadow-sm"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}