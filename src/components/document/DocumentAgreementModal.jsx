import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, MessageSquare, Edit2, Vote } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

export default function DocumentAgreementModal({ isOpen, onClose, onConfirm, isLoading }) {
  const { t, isRTL, language } = useLanguage();

  const content = {
    he: {
      title: "הבעת הסכמה כללית למסמך",
      description: "בלחיצה על כפתור 'אישור', את/ה מביע/ה הסכמה כללית לתוכן המסמך כפי שהוא מוצג כעת.",
      continueParticipating: "חשוב לזכור כי הסכמה זו אינה סוף הדיון; תוכל/י להמשיך ולהשתתף באופן פעיל בעיצוב ובדיוק המסמך באמצעות הכלים הקיימים במערכת:",
      discussions: "דיונים ותגובות",
      discussionsDesc: "הוסף/י הערות כלליות למסמך או תגובות ספציפיות לסעיפים.",
      suggestions: "הצעות שינוי",
      suggestionsDesc: "הצע/י סעיפים חדשים או ערוך/י סעיפים קיימים כדי לשפר את המסמך.",
      voting: "הצבעות",
      votingDesc: "השתתף/י בתהליך ההצבעה על הצעות כדי לקבוע את עתיד המסמך.",
      closing: "הסכמתך מחזקת את הקונצנזוס הקהילתי ומאפשרת לנו להתקדם יחד!",
      cancel: "ביטול",
      confirm: "אני מבין/ה ומאשר/ת"
    },
    en: {
      title: "Express General Agreement to Document",
      description: "By clicking 'Confirm', you express general agreement to the document's content as currently presented.",
      continueParticipating: "Remember that this agreement is not the end of the discussion; you can continue to actively participate in shaping and refining the document using the existing tools:",
      discussions: "Discussions & Comments",
      discussionsDesc: "Add general notes to the document or specific comments to sections.",
      suggestions: "Change Suggestions",
      suggestionsDesc: "Suggest new sections or edit existing ones to improve the document.",
      voting: "Voting",
      votingDesc: "Participate in voting on suggestions to determine the document's future.",
      closing: "Your agreement strengthens community consensus and allows us to move forward together!",
      cancel: "Cancel",
      confirm: "I Understand & Confirm"
    },
    ar: {
      title: "التعبير عن الموافقة العامة على المستند",
      description: "بالنقر على زر 'تأكيد'، فإنك تعبر عن موافقتك العامة على محتوى المستند كما هو معروض حاليًا.",
      continueParticipating: "تذكر أن هذه الموافقة ليست نهاية النقاش؛ يمكنك الاستمرار في المشاركة بنشاط في تشكيل وتحسين المستند باستخدام الأدوات الموجودة:",
      discussions: "المناقشات والتعليقات",
      discussionsDesc: "أضف ملاحظات عامة إلى المستند أو تعليقات محددة على الأقسام.",
      suggestions: "اقتراحات التغيير",
      suggestionsDesc: "اقترح أقسامًا جديدة أو عدّل الأقسام الموجودة لتحسين المستند.",
      voting: "التصويت",
      votingDesc: "شارك في التصويت على الاقتراحات لتحديد مستقبل المستند.",
      closing: "موافقتك تعزز الإجماع المجتمعي وتتيح لنا المضي قدمًا معًا!",
      cancel: "إلغاء",
      confirm: "أفهم وأؤكد"
    }
  };

  const c = content[language] || content.en;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            {c.title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-slate-700">{c.description}</p>
          
          <p className="text-slate-600 text-sm">{c.continueParticipating}</p>
          
          <div className="space-y-3 bg-slate-50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <MessageSquare className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-slate-900 text-sm">{c.discussions}</p>
                <p className="text-slate-600 text-xs">{c.discussionsDesc}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Edit2 className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-slate-900 text-sm">{c.suggestions}</p>
                <p className="text-slate-600 text-xs">{c.suggestionsDesc}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Vote className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-slate-900 text-sm">{c.voting}</p>
                <p className="text-slate-600 text-xs">{c.votingDesc}</p>
              </div>
            </div>
          </div>
          
          <p className="text-emerald-700 font-medium text-sm">{c.closing}</p>
        </div>

        <DialogFooter className={`gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {c.cancel}
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={isLoading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
              </span>
            ) : (
              c.confirm
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}