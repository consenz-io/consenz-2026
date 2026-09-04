import React from "react";
import { motion } from "framer-motion";
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
    he: 'consenz היא פלטפורמה המאפשרת לקהילות וארגונים לשתף את חבריהם בקבלת ההחלטות. היא כוללת מערכת ניקוד המעודדת השתתפות והופכת את התהליך לחוויה משחקית ומתגמלת, מנגנון ההצבעות חכם ורכיבי דיון ועריכה המאפשרים תהליך פורה גם עם אלפי משתתפים ויותר',
    ar: 'منصة قائمة على الذكاء الاصطناعي لإنشاء مستندات مشتركة في مجموعات كبيرة - بسرعة وشفافية وديمقراطية. يساعد الذكاء الاصطناعي في الصياغة وتكييف المحتوى لكل مشارك، مع ترجمة تلقائية بين اللغات وآلية إجماع ديناميكية تقرب الآراء وتضمن سماع كل صوت.',
    en: 'AI-powered platform for creating shared documents in large groups — quickly, transparently, and democratically. AI assists in drafting and adapting content for each participant, with automatic translation across languages and a dynamic consensus mechanism that bridges opinions and ensures every voice is heard.'
  };

  const agreementsLabel = { he: 'הסכמות והסכמים', ar: 'اتفاقيات وعقود', en: 'Agreements' };
  const tourLabel = { he: 'לסיור בפלטפורמה', ar: 'جولة في المنصة', en: 'Tour the Platform' };

  const startTutorial = () => {
    const STORAGE_KEY = 'consenz_tutorial';
    const fresh = { active: true, homeStepSeen: false, currentStep: 0, completedSteps: [] };
    try {localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));} catch {}
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
      {/* Background watermark logo — absolutely positioned, doesn't affect content flow */}
      <div className="absolute top-0 left-0 right-0 flex justify-center pt-3 md:pt-10 pointer-events-none select-none" aria-hidden="true">
        <div className="flex items-center gap-2 md:gap-3 opacity-[0.8]">
          <img src="https://media.base44.com/images/public/69ef99e5583af6a64ca3772e/5569749ec_image.png" alt="" className="w-9 h-9 md:w-16 md:h-16 shrink-0" />
          <span className="text-2xl md:text-6xl font-bold text-slate-900 tracking-tight">consenz</span>
        </div>
      </div>
      <div className="relative max-w-7xl md:py-32 py-20 px-5">
        <div className="text-center space-y-3 md:space-y-6">
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 px-4 py-2">
            {t('democraticCollaboration')}
          </Badge>
          <h1 id="hero-heading" className="font-bold leading-tight">
            <span className="text-slate-900 text-2xl md:text-5xl">{t('buildConsensusTitle')}</span>
            <br />
            <span className="text-lg md:text-4xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              {t('draftTogetherTitle')} {agreementsLabel[language] || agreementsLabel.en}
            </span>
          </h1>
          <p className="text-sm md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            {description[language] || description.en}
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <div ref={buttonRef}>
              {!showFloating &&
              <motion.div
                layoutId="tour-button"
                className="inline-flex"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}>
                
                  <Button
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  onClick={startTutorial}>
                  
                    {tourLabel[language] || tourLabel.en}
                    {isRTL ? <ArrowLeft className="w-4 h-4 mr-2" /> : <ArrowRight className="w-4 h-4 ml-2" />}
                  </Button>
                </motion.div>
              }
            </div>
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
          contributorsCount={contributorsCount} />
        
      </div>

      {/* Floating tour button — morphs from the original position via shared layoutId */}
      {showFloating &&
      <motion.div
        layoutId="tour-button"
        className="fixed bottom-6 inset-x-0 z-40 flex justify-center px-4 pointer-events-none"
        transition={{ type: "spring", stiffness: 300, damping: 30 }}>
        
          <Button
          size="lg"
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg pointer-events-auto"
          onClick={startTutorial}>
          
            {tourLabel[language] || tourLabel.en}
            {isRTL ? <ArrowLeft className="w-4 h-4 mr-2" /> : <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </motion.div>
      }
    </section>);

}