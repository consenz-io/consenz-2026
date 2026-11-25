import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, CalendarDays, ShieldCheck, FileText } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { legalContent } from "@/components/legal/index";

/**
 * Renders a legal document (privacy policy or terms of use) in the current
 * interface language, with a table of contents and readable measure.
 *
 * @param {"privacy"|"terms"} doc
 */
export default function LegalDocument({ doc }) {
  const { language, t, isRTL } = useLanguage();
  const bundle = legalContent[language] || legalContent.en;
  const content = bundle[doc];
  const updated = bundle.legalUpdated;
  const contactEmail = bundle.legalContactEmail;

  useEffect(() => {
    const previous = document.title;
    document.title = `${content.title} | Consenz`;
    return () => {
      document.title = previous;
    };
  }, [content.title]);

  const Icon = doc === "privacy" ? ShieldCheck : FileText;

  return (
    <div className="w-full max-w-full">
      <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-10 md:py-14">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-blue-100 hover:text-white transition-colors mb-6"
          >
            {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            {t("legalBackHome")}
          </Link>
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex items-center justify-center w-12 h-12 rounded-2xl bg-white/10 border border-white/20 shrink-0">
              <Icon className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-display">{content.title}</h1>
              <p className="mt-3 flex items-center gap-2 text-sm text-blue-100">
                <CalendarDays className="w-4 h-4" aria-hidden="true" />
                {t("legalLastUpdated")}: {updated}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="grid lg:grid-cols-[240px_1fr] gap-8 lg:gap-12">
          <nav aria-label={t("legalOnThisPage")} className="hidden lg:block">
            <div className="sticky top-24">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                {t("legalOnThisPage")}
              </p>
              <ul className="space-y-1.5 border-s border-slate-200 ps-3">
                {content.sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="block text-sm text-slate-600 hover:text-blue-700 leading-snug py-0.5"
                    >
                      {section.heading}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <article className="min-w-0">
            <p className="text-base leading-relaxed text-slate-700 bg-blue-50/60 border border-blue-100 rounded-xl p-4 md:p-5">
              {content.intro}
            </p>

            <div className="mt-8 space-y-8">
              {content.sections.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  <h2 className="text-lg md:text-xl font-bold text-slate-900 mb-3">{section.heading}</h2>
                  {section.paragraphs?.map((paragraph, index) => (
                    <p key={index} className="text-[15px] leading-relaxed text-slate-700 mb-3">
                      {paragraph}
                    </p>
                  ))}
                  {section.bullets?.length > 0 && (
                    <ul className="space-y-2 mt-2">
                      {section.bullets.map((bullet, index) => (
                        <li key={index} className="flex gap-2.5 text-[15px] leading-relaxed text-slate-700">
                          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" aria-hidden="true" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>

            <div className="mt-10 pt-6 border-t border-slate-200 text-sm text-slate-600">
              <p>
                {doc === "privacy" ? t("legalPrivacyPolicy") : t("legalTermsOfUse")} · Consenz ·{" "}
                <a href={`mailto:${contactEmail}`} className="text-blue-700 hover:underline">
                  {contactEmail}
                </a>
              </p>
              <div className="mt-3 flex flex-wrap gap-4">
                <Link to="/PrivacyPolicy" className="text-blue-700 hover:underline">
                  {t("legalPrivacyPolicy")}
                </Link>
                <Link to="/TermsOfUse" className="text-blue-700 hover:underline">
                  {t("legalTermsOfUse")}
                </Link>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}