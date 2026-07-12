import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import StatsCards from "./StatsCards";

const scrollToGroups = () => {
  const el = window.document?.getElementById('recent-documents-section');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

export default function HeroSection({ documentsCount, displayedUsers, publicProfilesLoading, averageConsensus, onContributorsClick, contributorsCount }) {
  const { t, isRTL, language } = useLanguage();

  const description = {
    he: 'פלטפורמה מבוססת AI ליצירת מסמכים משותפים בקבוצות גדולות — במהירות, בשקיפות ובאופן דמוקרטי. בינה מלאכותית מסייעת בתרגום אוטומטי בין שפות, ומנגנון ההצבעות יוצר קונצנזוס דינמי שמקרב בין דעות ומבטיח שכל קול יישמע.',
    ar: 'منصة قائمة على الذكاء الاصطناعي لإنشاء مستندات مشتركة في مجموعات كبيرة - بسرعة وشفافية وديمقراطية. يساعد الذكاء الاصطناعي في الصياغة وتكييف المحتوى لكل مشارك، مع ترجمة تلقائية بين اللغات وآلية إجماع ديناميكية تقرب الآراء وتضمن سماع كل صوت.',
    en: 'AI-powered platform for creating shared documents in large groups — quickly, transparently, and democratically. AI assists in drafting and adapting content for each participant, with automatic translation across languages and a dynamic consensus mechanism that bridges opinions and ensures every voice is heard.',
  };

  const agreementsLabel = { he: 'הסכמות והסכמים', ar: 'اتفاقيات وعقود', en: 'Agreements' };
  const tourLabel = { he: 'לסיור בפלטפורמה', ar: 'جولة في المنصة', en: 'Tour the Platform' };

  const startTutorial = () => {
    const STORAGE_KEY = 'consenz_tutorial';
    const fresh = { active: true, homeStepSeen: false, currentStep: 0, completedSteps: [] };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)); } catch {}
    if (window.restartTutorial) {
      window.restartTutorial('home');
    } else {
      window.location.reload();
    }
  };

  // Floating button: show when the original button scrolls out of view
  const buttonRef = React.useRef(null);
  const [showFloating, setShowFloating] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      const el = buttonRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setShowFloating(rect.bottom < 0);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-heading">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-indigo-600/10 to-purple-600/10" />
      <div className="relative max-w-7xl mx-auto px-6 py-20 md:py-32">
        <div className="text-center space-y-6">
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 px-4 py-1">
            {t('democraticCollaboration')}
          </Badge>
          <h1 id="hero-heading" className="font-bold leading-tight">
            <span className="text-4xl md:text-6xl text-slate-900">{t('buildConsensusTitle')}</span>
            <br />
            <span className="text-2xl md:text-4xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              {t('draftTogetherTitle')} {agreementsLabel[language] || agreementsLabel.en}
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto">
            {description[language] || description.en}
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button
              ref={buttonRef}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              onClick={startTutorial}
            >
              {tourLabel[language] || tourLabel.en}
              {isRTL ? <ArrowLeft className="w-4 h-4 mr-2" /> : <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
            <Link to={createPageUrl("LearnMore")}>
              <Button size="lg" variant="outline">{t('learnMore')}</Button>
            </Link>
          </div>
        </div>

        <StatsCards
          documentsCount={documentsCount}
          displayedUsers={displayedUsers}
          publicProfilesLoading={publicProfilesLoading}
          averageConsensus={averageConsensus}
          onContributorsClick={onContributorsClick}
          onDocumentsClick={scrollToGroups}
          contributorsCount={contributorsCount}
        />
      </div>

      {/* Floating tour button — appears after the original scrolls out of view */}
      {showFloating && (
        <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center pointer-events-none px-4">
          <Button
            size="lg"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-xl rounded-full pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-300"
            onClick={startTutorial}
          >
            {tourLabel[language] || tourLabel.en}
            {isRTL ? <ArrowLeft className="w-4 h-4 mr-2" /> : <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </div>
      )}
    </section>
  );
}