import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Users, Trophy, CheckCircle, MessageSquare, Sparkles, Languages } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import StatsCards from "./StatsCards";

const scrollToGroups = () => {
  const el = window.document?.getElementById('recent-documents-section');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

export default function HeroSection({ documentsCount, displayedUsers, publicProfilesLoading, averageConsensus, onContributorsClick, contributorsCount }) {
  const { t, isRTL, language } = useLanguage();

  const agreementsLabel = { he: 'הסכמות והסכמים', ar: 'اتفاقيات وعقود', en: 'Agreements' };
  const tourLabel = { he: 'לסיור בפלטפורמה', ar: 'جولة في المنصة', en: 'Tour the Platform' };

  const features = {
    he: [
    { icon: Users, title: 'שיתוף בקבלת החלטות', desc: 'קהילות וארגונים משתפים את חבריהם בתהליך' },
    { icon: Trophy, title: 'ניקוד וגיימיפיקציה', desc: 'השתתפות מתגמלת וחוויה משחקית' },
    { icon: CheckCircle, title: 'מנגנון הצבעות חכם', desc: 'קונצנזוס דינמי שמקרב דעות' },
    { icon: MessageSquare, title: 'דיון ועריכה', desc: 'תהליך פורה גם עם אלפי משתתפים' }],

    ar: [
    { icon: Sparkles, title: 'صياغة بالذكاء الاصطناعي', desc: 'يساعد في الصياغة وتكييف المحتوى' },
    { icon: Languages, title: 'ترجمة تلقائية', desc: 'بين اللغات تلقائياً وبدقة' },
    { icon: CheckCircle, title: 'إجماع ديناميكي', desc: 'يقرب الآراء ويسمع كل صوت' },
    { icon: Users, title: 'مجموعات كبيرة', desc: 'منتج حتى مع آلاف المشاركين' }],

    en: [
    { icon: Sparkles, title: 'AI-Assisted Drafting', desc: 'AI helps draft and adapt content' },
    { icon: Languages, title: 'Auto-Translation', desc: 'Across languages automatically' },
    { icon: CheckCircle, title: 'Dynamic Consensus', desc: 'Bridges opinions, every voice heard' },
    { icon: Users, title: 'Large Groups', desc: 'Productive even with thousands' }]

  };

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
      <div className="absolute top-0 left-0 right-0 flex justify-center pt-8 md:pt-10 pointer-events-none select-none" aria-hidden="true">
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
            <span className="text-slate-900 text-xl md:text-xl">{t('buildConsensusTitle')}</span>
            <br />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent text-base md:text-base">
              {t('draftTogetherTitle')} {agreementsLabel[language] || agreementsLabel.en}
            </span>
          </h1>
          <div className="max-w-3xl mx-auto py-1 md:py-3 px-2 md:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 md:gap-3">
              {(features[language] || features.en).map((feature, idx) =>
              <div key={idx} className="flex items-start gap-3 bg-white/70 backdrop-blur-sm border border-slate-200 rounded-xl p-3 md:p-3.5 shadow-sm hover:shadow-md transition-shadow text-start">
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white">
                    <feature.icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 text-sm md:text-base leading-tight">{feature.title}</h3>
                    <p className="text-slate-600 text-xs md:text-sm leading-relaxed mt-0.5">{feature.desc}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-4 justify-center flex-wrap">
            <div ref={buttonRef} className="w-full md:w-auto">
              {!showFloating &&
              <motion.div
                layoutId="tour-button"
                className="inline-flex w-full md:w-auto"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}>
                
                  <Button
                  size="lg"
                  className="w-full md:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  onClick={startTutorial}>
                  
                    {tourLabel[language] || tourLabel.en}
                    {isRTL ? <ArrowLeft className="w-4 h-4 mr-2" /> : <ArrowRight className="w-4 h-4 ml-2" />}
                  </Button>
                </motion.div>
              }
            </div>
            <Link to={createPageUrl("LearnMore")} className="hidden md:block">
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