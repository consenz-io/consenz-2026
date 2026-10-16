import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Users, Trophy, CheckCircle, MessageSquare } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import StatsCards from "./StatsCards";
import SingleLineHeroTitle from "@/components/home/SingleLineHeroTitle";

const scrollToGroups = () => {
  const el = window.document?.getElementById('recent-documents-section');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

export default function HeroSection({ documentsCount, displayedUsers, publicProfilesLoading, averageConsensus, onContributorsClick, contributorsCount }) {
  const { t, isRTL, language } = useLanguage();
  const [expandedCard, setExpandedCard] = React.useState(null);

  const agreementsLabel = { he: 'הסכמות והסכמים', ar: 'اتفاقيات وعقود', en: 'Agreements' };
  const tourLabel = { he: 'לסיור בפלטפורמה', ar: 'جولة في المنصة', en: 'Tour the Platform' };

  const moreLabel = { he: 'עוד..', ar: 'المزيد..', en: 'More..' };
  const lessLabel = { he: 'פחות', ar: 'أقل', en: 'Less' };

  const features = {
    he: [
    { icon: Users, title: 'שיתוף בקבלת החלטות', desc: 'קהילות וארגונים מחליטים יחד', longDesc: 'מקבוצה קטנה ועד לקהילה גדולה, יוצרים יחד מסמך שמגבש את ההחלטות המשותפות. המשתתפים מציעים סעיפים, שיפורים ומחיקות, דנים בכל שינוי ומצביעים עליו. הצעות שזוכות לתמיכה מספקת משתלבות במסמך, וכל תרומה מצטרפת ליצירה משותפת שמבטאת את ההסכמות ואת הדרך אליהן.' },
    { icon: Trophy, title: 'משחקיות שמתגמלת תרומה חיובית', desc: 'מערכת ניקוד לעידוד השתתפות', longDesc: 'מערכת ניקוד שמתגמלת משתתפים שתרמו לקידום הדיון לעבר הסכמות — למשל הצעות שהתקבלו, הצבעות שסייעו להן ותגובות שהקהילה העריכה. הנקודות עוזרות להבליט השתתפות מועילה ולצמצם רעשי רקע, בלי למחוק או להשתיק דעות. כך נוצר תהליך שיתופי, משחקי ומתגמל, שמעודד מעורבות חיובית לאורך זמן.' },
    { icon: CheckCircle, title: 'מנגנון הצבעות חכם', desc: 'קונצנזוס דינמי שמקרב דעות', longDesc: 'הצעה מתקבלת כשהפער בין קולות בעד ונגד מגיע לרף הנדרש. בכל קבלה, מד הקונצנזוס מתעדכן לפי רמת ההסכמה על השינויים שהתקבלו, ביחס למספר המשתתפים. המד משמש לחישוב רף התמיכה להצעות הבאות, לצד היקף ההשתתפות וההצבעה בפועל. כך כללי הקבלה מתפתחים עם הקהילה וההסכמות שהיא בונה, ומעודדים ניסוחים שמגייסים תמיכה רחבה.' },
    { icon: MessageSquare, title: 'שיתוף פעולה בקהילה גדולה', desc: 'דיונים רבים, מסמך משותף אחד', longDesc: 'גם כשהקהילה גדלה, אפשר להתקדם יחד: הדיונים וההצעות מחולקים לפי סעיפים, כך שמשתתפים רבים יכולים לקדם במקביל נושאים שונים. כל אחד משתתף בזמן שמתאים לו ובנושאים החשובים לו, בלי שכולם יצטרכו להיות באותו דיון באותו רגע. ההצבעות מרכזות את ההכרעות, והשינויים שמתקבלים מצטרפים למסמך משותף אחד שאפשר לעקוב אחר התפתחותו.' }],

    ar: [
    { icon: Users, title: 'المشاركة في اتخاذ القرارات', desc: 'مجتمعات ومؤسسات تقرر معاً', longDesc: 'من مجموعة صغيرة إلى مجتمع كبير، يُنشئ المشاركون معاً وثيقة تجمع القرارات المشتركة. يقترح المشاركون بنوداً وتحسينات وحذوفاً، ويناقشون كل تغيير ويصوّتون عليه. تُدمج الاقتراحات التي تحظى بدعم كافٍ في الوثيقة، وتنضم كل مساهمة إلى إبداع مشترك يعبّر عن التوافقات وعن الطريق إليها.' },
    { icon: Trophy, title: 'تلعيب يكافئ المساهمة الإيجابية', desc: 'نشجع المساهمة المفيدة، دون رأي', longDesc: 'يمنح نظام النقاط نقاطاً للمساهمات التي تدفع النقاش إلى الأمام — كالاقتراحات المقبولة، والأصوات التي ساعدتها، والتعليقات التي قدّرها المجتمع. تساعد النقاط على إبراز المشاركة المفيدة وتقليل الضوضاء، دون حذف الآراء أو إسكاتها. وهكذا ينشأ عملية تشاركية وتفاعلية ومجزية تشجع المشاركة الإيجابية المستمرة.' },
    { icon: CheckCircle, title: 'آلية تصويت ذكية', desc: 'إجماع ديناميكي يقرّب وجهات النظر', longDesc: 'يُقبل الاقتراح عندما يبلغ الفارق بين الأصوات المؤيدة والمعارضة العتبة المطلوبة. مع كل قبول، يُحدَّث مقياس الإجماع وفق مستوى الاتفاق على التغييرات المقبولة، بالنسبة إلى عدد المشاركين. ويُستخدم المقياس لحساب عتبة التأييد للاقتراحات التالية، إلى جانب حجم المشاركة والتصويت الفعلي. وهكذا تتطور قواعد القبول مع المجتمع والتوافقات التي يبنيها، وتشجع على صياغات تحظى بتأييد واسع.' },
    { icon: MessageSquare, title: 'التعاون في مجتمع كبير', desc: 'نقاشات عديدة، وثيقة مشتركة واحدة', longDesc: 'حتى مع نمو المجتمع، يمكن التقدم معاً: تُنظَّم النقاشات والاقتراحات بحسب البنود، مما يتيح لمشاركين كثيرين العمل بالتوازي على قضايا مختلفة. يشارك كل شخص في الوقت الذي يناسبه وفي القضايا التي تهمه، دون الحاجة إلى وجود الجميع في النقاش نفسه في اللحظة نفسها. يجمع التصويت القرارات، وتُدمج التغييرات المقبولة في وثيقة مشتركة واحدة يمكن متابعة تطورها.' }],

    en: [
    { icon: Users, title: 'Shared Decision-Making', desc: 'Communities and organizations decide together', longDesc: 'From a small group to a large community, participants create together a document that crystallizes their shared decisions. They propose sections, improvements, and deletions, discuss each change, and vote on it. Proposals that gain sufficient support become part of the document, and every contribution joins a shared creation that expresses the agreements and the path to them.' },
    { icon: Trophy, title: 'Gamification that Rewards Positive Contribution', desc: 'Encouraging useful contributions, without censoring views', longDesc: 'A points system awards points for contributions that advance the discussion — such as accepted proposals, votes that helped them, and comments the community valued. The points help surface useful participation and reduce noise, without deleting or silencing opinions. This creates a collaborative, playful, and rewarding process that encourages positive engagement over time.' },
    { icon: CheckCircle, title: 'Smart Voting', desc: 'Dynamic consensus brings views closer', longDesc: 'A proposal is accepted when the gap between votes for and against reaches the required threshold. With each acceptance, the consensus meter updates based on the level of agreement on accepted changes, relative to the number of participants. The meter helps calculate the support threshold for subsequent proposals, alongside participation levels and actual voting activity. Acceptance rules thus evolve with the community and the agreements it builds, encouraging wording that earns broad support.' },
    { icon: MessageSquare, title: 'Large-Community Collaboration', desc: 'Many discussions, one shared document', longDesc: 'Even as the community grows, participants can move forward together: discussions and proposals are organized by section, allowing many people to work on different issues in parallel. Everyone can contribute when it suits them, on issues that matter to them, without everyone needing to join the same discussion at the same time. Voting brings decisions together, and accepted changes become part of one shared document whose development can be followed over time.' }]

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
            <SingleLineHeroTitle>{t('buildConsensusTitle')}</SingleLineHeroTitle>
            <br />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent text-base md:text-4xl">
              {t('draftTogetherTitle')} {agreementsLabel[language] || agreementsLabel.en}
            </span>
          </h1>
          <div className="max-w-3xl mx-auto py-1 md:py-3 px-2 md:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 md:gap-3">
              {(features[language] || features.en).map((feature, idx) =>
              <div key={idx} className="flex flex-col bg-white/70 backdrop-blur-sm border border-slate-200 rounded-xl p-3 md:p-3.5 shadow-sm hover:shadow-md transition-shadow text-start">
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white">
                    <feature.icon className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-900 text-[13px] md:text-base leading-[1.15]">{feature.title}</h3>
                    <p className="text-slate-600 text-xs md:text-sm leading-relaxed mt-0.5 inline">{feature.desc}</p>
                    <button
                      onClick={() => setExpandedCard(expandedCard === idx ? null : idx)}
                      className="inline text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors mr-1"
                      aria-expanded={expandedCard === idx}>
                      {expandedCard === idx ? (lessLabel[language] || lessLabel.en) : (moreLabel[language] || moreLabel.en)}
                    </button>
                  </div>
                </div>
                {expandedCard === idx &&
                <p className="text-slate-600 text-xs md:text-sm leading-relaxed mt-2 pt-2 border-t border-slate-200">
                  {feature.longDesc}
                </p>
                }
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