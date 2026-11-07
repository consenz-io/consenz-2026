import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FileText, TrendingUp, Users, Loader2, ArrowLeft, ArrowRight } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

const TILE_BASE =
  "group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-center " +
  "transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-offset-2";

function TileGlow({ palette }) {
  return (
    <>
      <span
        className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${palette}`}
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute -top-16 start-1/2 h-32 w-32 -translate-x-1/2 rounded-full bg-slate-900/[0.03] blur-2xl"
        aria-hidden="true"
      />
    </>
  );
}

function TileIcon({ icon: Icon, tint }) {
  return (
    <span
      className={`mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full ${tint} ring-1 ring-inset ring-slate-900/5`}
      aria-hidden="true"
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}

export default function StatsCards({
  documentsCount,
  displayedUsers,
  publicProfilesLoading,
  averageConsensus,
  onContributorsClick,
  onDocumentsClick,
  contributorsCount,
}) {
  const { t, language, isRTL } = useLanguage();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const hintFor = (he, ar, en) =>
    language === 'he' ? he : language === 'ar' ? ar : en;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6 mt-16">
      {/* Active Documents */}
      <button
        type="button"
        className={`${TILE_BASE} hover:border-blue-300 focus-visible:ring-blue-400`}
        onClick={onDocumentsClick}
        aria-label={`${documentsCount} ${t('activeDocuments')}. ${hintFor('לחץ לגלילה למסמכים', 'انقر للتمرير إلى الوثائق', 'Click to scroll to documents')}`}
      >
        <TileGlow palette="from-blue-500 via-sky-400 to-transparent" />
        <TileIcon icon={FileText} tint="bg-blue-50 text-blue-600" />
        <div
          className="text-4xl md:text-5xl font-bold leading-none text-slate-900 tabular-nums"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {documentsCount}
        </div>
        <div className="mt-3 text-[0.7rem] font-medium uppercase tracking-[0.14em] text-slate-500">
          {t('activeDocuments')}
        </div>
        <ArrowIcon
          className="mx-auto mt-3 h-4 w-4 text-blue-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          aria-hidden="true"
        />
      </button>

      {/* Collaborators */}
      <button
        type="button"
        className={`${TILE_BASE} hover:border-indigo-300 focus-visible:ring-indigo-400`}
        onClick={onContributorsClick}
        aria-label={`${contributorsCount ?? displayedUsers.length} ${t('collaborators')}. ${hintFor('לחץ לצפייה ברשימה מלאה', 'انقر لعرض القائمة الكاملة', 'Click to view full list')}`}
      >
        <TileGlow palette="from-indigo-500 via-violet-400 to-transparent" />
        <TileIcon icon={Users} tint="bg-indigo-50 text-indigo-600" />
        <div
          className="flex min-h-[2rem] items-center justify-center text-4xl md:text-5xl font-bold leading-none text-slate-900 tabular-nums"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {publicProfilesLoading ? (
            <Loader2
              className="h-8 w-8 animate-spin text-indigo-400"
              aria-label={hintFor('טוען...', 'جارٍ التحميل...', 'Loading...')}
            />
          ) : (
            contributorsCount ?? displayedUsers.length
          )}
        </div>
        <div className="mt-3 text-[0.7rem] font-medium uppercase tracking-[0.14em] text-slate-500">
          {t('collaborators')}
        </div>
        <ArrowIcon
          className="mx-auto mt-3 h-4 w-4 text-indigo-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          aria-hidden="true"
        />
      </button>

      {/* Average Consensus */}
      <Link
        to={`${createPageUrl("LearnMore")}#consensus-calculation`}
        className={`${TILE_BASE} block hover:border-purple-300 focus-visible:ring-purple-400`}
      >
        <TileGlow palette="from-purple-500 via-fuchsia-400 to-transparent" />
        <TileIcon icon={TrendingUp} tint="bg-purple-50 text-purple-600" />
        <div
          className="text-4xl md:text-5xl font-bold leading-none text-slate-900 tabular-nums"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {averageConsensus}%
        </div>
        <div className="mt-3 text-[0.7rem] font-medium uppercase tracking-[0.14em] text-slate-500">
          {t('avgConsensus')}
        </div>
        <ArrowIcon
          className="mx-auto mt-3 h-4 w-4 text-purple-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          aria-hidden="true"
        />
      </Link>
    </div>
  );
}