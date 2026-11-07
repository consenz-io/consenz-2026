export default function LearnMoreAudiences({ c }) {
  return (
    <section className="border-y border-slate-200 bg-white/60 backdrop-blur-sm">
      <div className="mx-auto max-w-4xl px-6 py-12 text-center">
        <h2 className="text-lg font-semibold text-slate-900 md:text-xl">{c.title}</h2>
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          {c.items.map((item) => (
            <span
              key={item}
              className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}