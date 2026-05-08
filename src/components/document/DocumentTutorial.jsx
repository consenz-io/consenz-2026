import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/LanguageContext";

const tutorialSteps = {
  en: [
    {
      id: "navigation",
      title: "Navigate Suggestions",
      description: "Use the arrows to browse through open suggestions that need your vote. Each suggestion shows voting progress and how many votes are needed.",
      highlightSelector: "#suggestions-nav",
      position: "bottom",
    },
    {
      id: "voting",
      title: "Vote on Suggestions",
      description: "Click PRO or CON to vote on a suggestion. Your vote counts toward reaching the consensus threshold needed for acceptance.",
      highlightSelector: ".voting-buttons",
      position: "left",
    },
    {
      id: "comments",
      title: "Discuss and Comment",
      description: "Add comments and replies to discuss suggestions with the community. See arguments both for and against each proposal.",
      highlightSelector: "#comments-section",
      position: "top",
    },
    {
      id: "new-suggestion",
      title: "Propose Changes",
      description: "Suggest new sections, edit existing ones, or propose deletions. Click the '+' button to create a suggestion.",
      highlightSelector: ".plus-button-suggest",
      position: "left",
    },
    {
      id: "consensus",
      title: "Understand Consensus",
      description: "The consensus meter shows community agreement. Suggestions need to meet the dynamic threshold which is based on previous decisions.",
      highlightSelector: "a[href*='UnderstandingConsensus']",
      position: "left",
    },
    {
      id: "versions",
      title: "Review Versions",
      description: "View the document's version history to see all accepted changes. Navigate between versions to see what evolved.",
      highlightSelector: "a[href*='DocumentCleanView']",
      position: "left",
    },
    {
      id: "points",
      title: "Gamification Points",
      description: "Earn points for creating suggestions, receiving votes, and helping the community. Points can be used to create future suggestions when gamification is enabled.",
      highlightSelector: "#points-badge",
      position: "left",
    },
  ],
  he: [
    {
      id: "navigation",
      title: "ניווט בהצעות",
      description: "השתמש בחיצים כדי לעיין בהצעות פתוחות שצריכות את הצבעתך. כל הצעה מציגה התקדמות הצבעה וכמה הצבעות נדרשות.",
      highlightSelector: "#suggestions-nav",
      position: "bottom",
    },
    {
      id: "voting",
      title: "הצביע על הצעות",
      description: "לחץ בעד או נגד כדי להצביע על הצעה. ההצבעה שלך סופרת לעבור את סף הקונצנזוס הדרוש לקבלה.",
      highlightSelector: ".voting-buttons",
      position: "right",
    },
    {
      id: "comments",
      title: "דיון והערות",
      description: "הוסף תגובות ותשובות כדי לדון בהצעות עם הקהילה. ראה טיעונים בעד ונגד כל הצעה.",
      highlightSelector: "#comments-section",
      position: "top",
    },
    {
      id: "new-suggestion",
      title: "הצע שינויים",
      description: "הצע סעיפים חדשים, ערוך קיימים או הצע מחיקות. לחץ על כפתור '+' כדי ליצור הצעה.",
      highlightSelector: ".plus-button-suggest",
      position: "right",
    },
    {
      id: "consensus",
      title: "הבנת קונצנזוס",
      description: "מד הקונצנזוס מציג הסכמה בקהילה. הצעות צריכות לעמוד בסף דינמי המבוסס על החלטות קודמות.",
      highlightSelector: "a[href*='UnderstandingConsensus']",
      position: "right",
    },
    {
      id: "versions",
      title: "סקור גרסאות",
      description: "צפה בהיסטוריית גרסאות המסמך לראות כל השינויים שהתקבלו. עיין בין גרסאות לראות מה התפתח.",
      highlightSelector: "a[href*='DocumentCleanView']",
      position: "right",
    },
    {
      id: "points",
      title: "נקודות גיימיפיקציה",
      description: "קבל נקודות ביצירת הצעות, קבלת הצבעות, וסיוע לקהילה. ניתן להשתמש בנקודות ליצירת הצעות עתידיות כשהגיימיפיקציה מופעלת.",
      highlightSelector: "#points-badge",
      position: "right",
    },
  ],
  ar: [
    {
      id: "navigation",
      title: "التنقل بين الاقتراحات",
      description: "استخدم الأسهم لتصفح الاقتراحات المفتوحة التي تحتاج إلى تصويتك. يعرض كل اقتراح تقدم التصويت وعدد الأصوات المطلوبة.",
      highlightSelector: "#suggestions-nav",
      position: "bottom",
    },
    {
      id: "voting",
      title: "التصويت على الاقتراحات",
      description: "انقر على مع أو ضد للتصويت على اقتراح. يُحسب صوتك نحو الوصول إلى عتبة الإجماع اللازمة للقبول.",
      highlightSelector: ".voting-buttons",
      position: "right",
    },
    {
      id: "comments",
      title: "النقاش والتعليقات",
      description: "أضف التعليقات والرد للمناقشة مع المجتمع. انظر الحجج للصالح والضد لكل اقتراح.",
      highlightSelector: "#comments-section",
      position: "top",
    },
    {
      id: "new-suggestion",
      title: "اقترح التغييرات",
      description: "اقترح أقسام جديدة أو عدّل الأقسام القائمة أو اقترح الحذف. انقر على زر '+' لإنشاء اقتراح.",
      highlightSelector: ".plus-button-suggest",
      position: "right",
    },
    {
      id: "consensus",
      title: "فهم الإجماع",
      description: "يعرض مقياس الإجماع اتفاق المجتمع. يجب أن تفي الاقتراحات بعتبة ديناميكية تستند إلى القرارات السابقة.",
      highlightSelector: "a[href*='UnderstandingConsensus']",
      position: "right",
    },
    {
      id: "versions",
      title: "مراجعة الإصدارات",
      description: "اعرض سجل إصدارات المستند لرؤية جميع التغييرات المقبولة. تنقل بين الإصدارات لرؤية التطور.",
      highlightSelector: "a[href*='DocumentCleanView']",
      position: "right",
    },
    {
      id: "points",
      title: "نقاط المستوى",
      description: "احصل على نقاط لإنشاء الاقتراحات والحصول على الأصوات والمساعدة في المجتمع. يمكن استخدام النقاط لإنشاء اقتراحات مستقبلية عند تفعيل المستوى.",
      highlightSelector: "#points-badge",
      position: "right",
    },
  ],
};

const Bubble = ({ step, currentIndex, totalSteps, onNext, onPrev, onClose, isRTL }) => {
  const { language } = useLanguage();
  const labels = {
    en: { next: "Next", prev: "Back", skip: "Skip Tutorial", finish: "Got it!" },
    he: { next: "הבא", prev: "חזור", skip: "דלג על הטוטוריאל", finish: "הבנתי!" },
    ar: { next: "التالي", prev: "الخلف", skip: "تخطي البرنامج التعليمي", finish: "فهمت!" },
  };

  const label = labels[language] || labels.en;
  const isLast = currentIndex === totalSteps - 1;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className={`bg-white rounded-lg shadow-2xl p-4 max-w-xs z-[200] ${isRTL ? 'text-right' : 'text-left'}`}
    >
      <div className="space-y-3">
        <h3 className="font-bold text-lg text-slate-900">{step.title}</h3>
        <p className="text-sm text-slate-600 leading-relaxed">{step.description}</p>

        <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
          <div className="flex-1 h-1 bg-slate-200 rounded-full">
            <div
              className="h-full bg-blue-600 rounded-full transition-all"
              style={{ width: `${((currentIndex + 1) / totalSteps) * 100}%` }}
            />
          </div>
          <span className="font-medium">
            {currentIndex + 1} / {totalSteps}
          </span>
        </div>

        <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {currentIndex > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onPrev}
              className="flex-1"
              aria-label={label.prev}
            >
              {isRTL ? <ChevronRight className="w-4 h-4 ml-1" /> : <ChevronLeft className="w-4 h-4 mr-1" />}
              {label.prev}
            </Button>
          )}
          <Button
            variant="default"
            size="sm"
            onClick={isLast ? onClose : onNext}
            className={`flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 ${isRTL ? '' : ''}`}
            aria-label={isLast ? label.finish : label.next}
          >
            {isLast ? label.finish : label.next}
            {!isLast && (isRTL ? <ChevronLeft className="w-4 h-4 mr-1" /> : <ChevronRight className="w-4 h-4 ml-1" />)}
          </Button>
        </div>

        <button
          onClick={onClose}
          className="w-full text-center text-xs text-slate-500 hover:text-slate-700 transition-colors py-1"
          aria-label={label.skip}
        >
          {label.skip}
        </button>
      </div>
    </motion.div>
  );
};

const HighlightBox = ({ selector, position, onClose, children }) => {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    const element = document.querySelector(selector);
    if (element) {
      const bounding = element.getBoundingClientRect();
      setRect({
        top: bounding.top,
        left: bounding.left,
        width: bounding.width,
        height: bounding.height,
      });
    }
  }, [selector]);

  if (!rect) return null;

  const padding = 12;
  const bubbleWidth = 300;
  const bubbleHeight = 280;

  let bubbleTop = rect.top + rect.height + padding;
  let bubbleLeft = rect.left + rect.width / 2 - bubbleWidth / 2;

  if (position === "left") {
    bubbleLeft = rect.left - bubbleWidth - padding;
    bubbleTop = rect.top + rect.height / 2 - bubbleHeight / 2;
  } else if (position === "right") {
    bubbleLeft = rect.left + rect.width + padding;
    bubbleTop = rect.top + rect.height / 2 - bubbleHeight / 2;
  } else if (position === "top") {
    bubbleTop = rect.top - bubbleHeight - padding;
  }

  bubbleLeft = Math.max(10, Math.min(bubbleLeft, window.innerWidth - bubbleWidth - 10));
  bubbleTop = Math.max(10, Math.min(bubbleTop, window.innerHeight - bubbleHeight - 10));

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black/40 z-[180]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.svg
        className="fixed inset-0 z-[185] pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <defs>
          <mask id="tutorial-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={rect.left - padding}
              y={rect.top - padding}
              width={rect.width + padding * 2}
              height={rect.height + padding * 2}
              fill="black"
              rx="8"
            />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="black" mask="url(#tutorial-mask)" opacity="0.5" />
        <rect
          x={rect.left - padding}
          y={rect.top - padding}
          width={rect.width + padding * 2}
          height={rect.height + padding * 2}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          rx="8"
        />
      </motion.svg>

      <motion.div
        className="fixed z-[190]"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ top: bubbleTop, left: bubbleLeft }}
      >
        {children}
      </motion.div>
    </>
  );
};

export default function DocumentTutorial({ documentId }) {
  const { language } = useLanguage();
  const { isRTL } = useLanguage();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const steps = tutorialSteps[language] || tutorialSteps.en;

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem(`tutorial-seen-${documentId}`);
    if (!hasSeenTutorial) {
      const timer = setTimeout(() => setIsVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, [documentId]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    localStorage.setItem(`tutorial-seen-${documentId}`, "true");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  const step = steps[currentStep];

  return (
    <AnimatePresence>
      <HighlightBox
        selector={step.highlightSelector}
        position={step.position}
        onClose={handleClose}
      >
        <Bubble
          step={step}
          currentIndex={currentStep}
          totalSteps={steps.length}
          onNext={handleNext}
          onPrev={handlePrev}
          onClose={handleClose}
          isRTL={isRTL}
        />
      </HighlightBox>
    </AnimatePresence>
  );
}