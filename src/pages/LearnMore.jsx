import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, Users, Vote, CheckCircle, MessageSquare, 
  TrendingUp, ArrowRight, ChevronRight, ArrowLeft,
  Edit3, Plus, ThumbsUp, ThumbsDown, Clock
} from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

export default function LearnMore() {
  const { t, isRTL, language } = useLanguage();
  const [activeStep, setActiveStep] = useState(0);
  const location = useLocation();

  // Scroll to consensus-calculation section if hash is present
  useEffect(() => {
    if (location.hash === '#consensus-calculation') {
      setTimeout(() => {
        const element = document.getElementById('consensus-calculation');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [location.hash]);

  const getLocalizedText = (en, he, ar) => {
    if (language === 'ar') return ar;
    if (language === 'he') return he;
    return en;
  };

  const steps = [
    {
      title: getLocalizedText("Create a Document", "יצירת מסמך", "إنشاء وثيقة"),
      description: getLocalizedText(
        "Start by creating a new collaborative document. Define main topics and initial sections.",
        "התחל על ידי יצירת מסמך שיתופי חדש. הגדר את הנושאים העיקריים והסעיפים הראשוניים.",
        "ابدأ بإنشاء وثيقة تعاونية جديدة. حدد المواضيع الرئيسية والأقسام الأولية."
      ),
      icon: FileText,
      color: "from-blue-500 to-indigo-500",
      steps: language === 'ar' ? [
        "انقر على 'وثيقة جديدة'",
        "أدخل العنوان واختر إعدادات الخصوصية",
        "أضف مواضيع وأقسام أولية",
        "انشر الوثيقة"
      ] : language === 'he' ? [
        "לחץ על 'מסמך חדש'",
        "הזן כותרת ובחר הגדרות פרטיות",
        "הוסף נושאים וסעיפים ראשוניים",
        "פרסם את המסמך"
      ] : [
        "Click 'New Document'",
        "Enter title and choose privacy settings",
        "Add initial topics and sections",
        "Publish the document"
      ]
    },
    {
      title: getLocalizedText("Suggest Changes", "הצעת שינויים", "اقتراح تغييرات"),
      description: getLocalizedText(
        "Any user can suggest changes to the document - editing existing sections or adding new ones.",
        "כל משתמש יכול להציע שינויים למסמך - עריכת סעיפים קיימים או הוספת סעיפים חדשים.",
        "يمكن لأي مستخدم اقتراح تغييرات على الوثيقة - تحرير الأقسام الموجودة أو إضافة أقسام جديدة."
      ),
      icon: Edit3,
      color: "from-purple-500 to-pink-500",
      steps: language === 'ar' ? [
        "انقر على 'اقتراح جديد'",
        "اختر بين تحرير قسم موجود أو إضافة قسم جديد",
        "اكتب المحتوى المقترح",
        "أضف شرحًا لسبب الحاجة لهذا التغيير",
        "أرسل الاقتراح"
      ] : language === 'he' ? [
        "לחץ על 'הצעה חדשה'",
        "בחר בין עריכת סעיף קיים להוספת סעיף חדש",
        "כתוב את התוכן המוצע",
        "הוסף הסבר מדוע השינוי נדרש",
        "שלח את ההצעה"
      ] : [
        "Click 'New Suggestion'",
        "Choose between editing existing section or adding new",
        "Write the proposed content",
        "Add explanation for the change",
        "Submit the suggestion"
      ]
    },
    {
      title: getLocalizedText("Vote on Suggestions", "הצבעה על הצעות", "التصويت على المقترحات"),
      description: getLocalizedText(
        "Users vote on suggestions - pro or con. The suggestion passes when it reaches the consensus threshold.",
        "המשתמשים מצביעים על הצעות - בעד או נגד. ההצעה עוברת כאשר היא עוברת את סף הקונצנזוס.",
        "يصوت المستخدمون على المقترحات - مع أو ضد. يتم تمرير المقترح عندما يصل إلى عتبة الإجماع."
      ),
      icon: Vote,
      color: "from-green-500 to-teal-500",
      steps: language === 'ar' ? [
        "راجع المقترحات المعلقة",
        "اقرأ المحتوى المقترح والشرح",
        "صوت 'مع' إذا كنت تدعمه",
        "صوت 'ضد' إذا كنت تعارضه",
        "يتم قبول المقترح تلقائيًا إذا تجاوز العتبة"
      ] : language === 'he' ? [
        "עיין בהצעות הממתינות",
        "קרא את התוכן המוצע וההסבר",
        "הצבע 'בעד' אם אתה תומך",
        "הצבע 'נגד' אם אתה מתנגד",
        "ההצעה תתקבל אוטומטית אם תעבור את הסף"
      ] : [
        "Review pending suggestions",
        "Read the proposed content and explanation",
        "Vote 'Pro' if you support it",
        "Vote 'Con' if you oppose it",
        "Suggestion is auto-accepted if threshold is met"
      ]
    },
    {
      title: getLocalizedText("Discussion & Comments", "דיון ותגובות", "النقاش والتعليقات"),
      description: getLocalizedText(
        "Participate in discussions, add pro and con arguments, and reply to other users' comments.",
        "השתתף בדיונים, הוסף טיעונים בעד ונגד, והגב לתגובות של משתמשים אחרים.",
        "شارك في النقاشات، أضف حججًا مع وضد، ورد على تعليقات المستخدمين الآخرين."
      ),
      icon: MessageSquare,
      color: "from-orange-500 to-red-500",
      steps: language === 'ar' ? [
        "قم بالتمرير لأسفل في صفحة المقترح",
        "أضف حجة مع أو ضد",
        "رد على حجج الآخرين",
        "أضف تعليقات على أقسام الوثيقة"
      ] : language === 'he' ? [
        "גלול למטה בעמוד ההצעה",
        "הוסף טיעון בעד או נגד",
        "הגב לטיעונים של אחרים",
        "הוסף תגובות לסעיפים במסמך"
      ] : [
        "Scroll down on suggestion page",
        "Add pro or con arguments",
        "Reply to others' arguments",
        "Add comments to document sections"
      ]
    },
    {
      title: getLocalizedText("Dynamic Consensus", "קונצנזוס דינמי", "الإجماع الديناميكي"),
      description: getLocalizedText(
        "The algorithm calculates a dynamic consensus threshold based on the history of accepted suggestions.",
        "האלגוריתם מחשב סף קונצנזוס דינמי על בסיס היסטוריית ההצעות שהתקבלו במסמך.",
        "تحسب الخوارزمية عتبة إجماع ديناميكية بناءً على تاريخ المقترحات المقبولة."
      ),
      icon: TrendingUp,
      color: "from-indigo-500 to-purple-500",
      steps: language === 'ar' ? [
        "تبدأ العتبة بقيمة افتراضية",
        "كل مقترح مقبول يؤثر على العتبة",
        "يتم تحديث العتبة تلقائيًا",
        "المقترحات ذات الإجماع الأعلى تخفض العتبة",
        "يتكيف النظام مع المجتمع"
      ] : language === 'he' ? [
        "הסף מתחיל בערך ברירת מחדל",
        "כל הצעה שמתקבלת משפיעה על הסף",
        "הסף מתעדכן באופן אוטומטי",
        "הצעות עם קונצנזוס גבוה יותר מורידות את הסף",
        "המערכת מתאימה את עצמה לקהילה"
      ] : [
        "Threshold starts at default value",
        "Each accepted suggestion affects the threshold",
        "Threshold updates automatically",
        "Suggestions with higher consensus lower the threshold",
        "System adapts to the community"
      ]
    }
  ];

  const features = [
    {
      icon: Users,
      title: getLocalizedText("Democratic Collaboration", "שיתוף פעולה דמוקרטי", "التعاون الديمقراطي"),
      description: getLocalizedText(
        "Every user can suggest changes and the community decides together",
        "כל משתמש יכול להציע שינויים והקהילה מחליטה יחד",
        "يمكن لكل مستخدم اقتراح تغييرات ويقرر المجتمع معًا"
      )
    },
    {
      icon: TrendingUp,
      title: getLocalizedText("Smart Consensus Algorithm", "אלגוריתם קונצנזוס חכם", "خوارزمية إجماع ذكية"),
      description: getLocalizedText(
        "Dynamic threshold that adapts to voting history",
        "סף דינמי שמתאים את עצמו להיסטוריית ההצבעות",
        "عتبة ديناميكية تتكيف مع تاريخ التصويت"
      )
    },
    {
      icon: CheckCircle,
      title: getLocalizedText("Automatic Approval", "אישור אוטומטי", "الموافقة التلقائية"),
      description: getLocalizedText(
        "Suggestions are auto-approved when they pass the threshold",
        "הצעות מאושרות אוטומטית כשהן עוברות את הסף",
        "يتم الموافقة على المقترحات تلقائيًا عند تجاوز العتبة"
      )
    },
    {
      icon: MessageSquare,
      title: getLocalizedText("Structured Discussion", "דיון מובנה", "نقاش منظم"),
      description: getLocalizedText(
        "Pro and con arguments, comments and replies on documents and suggestions",
        "טיעונים בעד ונגד, תגובות ותשובות למסמך ולהצעות",
        "حجج مع وضد، تعليقات وردود على الوثائق والمقترحات"
      )
    },
    {
      icon: Clock,
      title: getLocalizedText("Voting Time Management", "ניהול זמן הצבעה", "إدارة وقت التصويت"),
      description: getLocalizedText(
        "Set time period for voting on suggestions",
        "הגדר פרק זמן להצבעה על הצעות",
        "حدد فترة زمنية للتصويت على المقترحات"
      )
    },
    {
      icon: FileText,
      title: getLocalizedText("Version History", "היסטוריית גרסאות", "سجل الإصدارات"),
      description: getLocalizedText(
        "Track all document changes with restore capability",
        "מעקב אחר כל השינויים במסמך עם אפשרות שחזור",
        "تتبع جميع تغييرات الوثيقة مع إمكانية الاستعادة"
      )
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-indigo-600/10 to-purple-600/10" />
        <div className="relative max-w-7xl mx-auto px-6 py-20">
          <Link to={createPageUrl("Home")}>
            <Button variant="outline" size="sm" className="mb-6">
              {isRTL ? (
                <>
                  {getLocalizedText("Back to Home", "חזרה לדף הבית", "العودة إلى الصفحة الرئيسية")}
                  <ArrowRight className="w-4 h-4 mr-2" />
                </>
              ) : (
                <>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {getLocalizedText("Back to Home", "חזרה לדף הבית", "العودة إلى الصفحة الرئيسية")}
                </>
              )}
            </Button>
          </Link>
          
          <div className={`text-center space-y-6 ${isRTL ? 'rtl' : 'ltr'}`}>
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900">
              {getLocalizedText("How Consenz Works?", "איך Consenz עובד?", "كيف يعمل Consenz؟")}
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              {getLocalizedText(
                "A platform for democratic collaboration in drafting policy documents, constitutions, and decisions using dynamic consensus algorithms",
                "פלטפורמה לשיתוף פעולה דמוקרטי בניסוח מסמכי מדיניות, חוקות והחלטות באמצעות אלגוריתמי קונצנזוס דינמיים",
                "منصة للتعاون الديمقراطي في صياغة وثائق السياسة والدساتير والقرارات باستخدام خوارزميات إجماع ديناميكية"
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Tutorial */}
      <section className={`max-w-7xl mx-auto px-6 py-16 ${isRTL ? 'rtl' : 'ltr'}`}>
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            {getLocalizedText("Step-by-Step Guide", "מדריך שלב אחר שלב", "دليل خطوة بخطوة")}
          </h2>
          <p className="text-slate-600">
            {getLocalizedText(
              "Learn how to use the system in five simple steps",
              "למד איך להשתמש במערכת בחמישה שלבים פשוטים",
              "تعلم كيفية استخدام النظام في خمس خطوات بسيطة"
            )}
          </p>
        </div>

        {/* Step Navigation */}
        <div className="flex justify-center mb-8 flex-wrap gap-2">
          {steps.map((step, index) => (
            <Button
              key={index}
              variant={activeStep === index ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveStep(index)}
              className={activeStep === index ? `bg-gradient-to-r ${step.color}` : ""}
            >
              {index + 1}. {step.title}
            </Button>
          ))}
        </div>

        {/* Active Step Content */}
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-xl" dir={isRTL ? 'rtl' : 'ltr'}>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${steps[activeStep].color} flex items-center justify-center shadow-lg flex-shrink-0`}>
                {React.createElement(steps[activeStep].icon, { className: "w-8 h-8 text-white" })}
              </div>
              <div className="flex-1">
                <CardTitle className="text-2xl">{steps[activeStep].title}</CardTitle>
                <p className="text-slate-600 mt-1">{steps[activeStep].description}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {steps[activeStep].steps.map((stepText, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br ${steps[activeStep].color} flex items-center justify-center text-white font-bold shadow-lg`}>
                    {index + 1}
                  </div>
                  <p className="text-slate-700 pt-1 flex-1">{stepText}</p>
                </div>
              ))}
            </div>

            {/* Navigation Buttons */}
            <div className={`flex justify-between mt-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Button
                variant="outline"
                onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
                disabled={activeStep === 0}
                className="flex items-center gap-2"
              >
                {isRTL ? (
                  <>
                    <span>{getLocalizedText("Previous", "הקודם", "السابق")}</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <ArrowLeft className="w-4 h-4" />
                    <span>{getLocalizedText("Previous", "הקודם", "السابق")}</span>
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setActiveStep(Math.min(steps.length - 1, activeStep + 1))}
                disabled={activeStep === steps.length - 1}
                className="flex items-center gap-2"
              >
                {isRTL ? (
                  <>
                    <span>{getLocalizedText("Next", "הבא", "التالي")}</span>
                    <ArrowLeft className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>{getLocalizedText("Next", "הבא", "التالي")}</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Gamification & Points System */}
      <section className={`max-w-7xl mx-auto px-6 py-16 ${isRTL ? 'rtl' : 'ltr'}`}>
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            {getLocalizedText("Points & Gamification System", "מערכת ניקוד וגיימיפיקציה", "نظام النقاط والتلعيب")}
          </h2>
          <p className="text-slate-600 max-w-3xl mx-auto">
            {getLocalizedText(
              "A reputation and incentive system designed to filter noise, build credibility, and reward positive contributions measured by community consensus",
              "מערכת מוניטין ותמריצים שנועדה לסנן רעשים, לבנות אמינות ולתגמל תרומות חיוביות הנמדדות בהסכמת הקהילה",
              "نظام سمعة وحوافز مصمم لتصفية الضوضاء، وبناء المصداقية، ومكافأة المساهمات الإيجابية المقاسة بإجماع المجتمع"
            )}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Costs Table */}
          <Card className="bg-white/80 backdrop-blur-sm border-red-200">
            <CardHeader className="bg-gradient-to-br from-red-50 to-orange-50">
              <CardTitle className={`text-xl flex items-center gap-2 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                <ThumbsDown className="w-6 h-6 text-red-600" />
                {getLocalizedText("Costs", "עלויות", "التكاليف")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className={`flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <p className="font-semibold text-slate-900">
                      {getLocalizedText("Create Document", "פרסום מסמך", "نشر وثيقة")}
                    </p>
                    <p className="text-sm text-slate-600">
                      {getLocalizedText("Cost to publish a new document", "עלות פרסום מסמך חדש", "تكلفة نشر وثيقة جديدة")}
                    </p>
                  </div>
                  <Badge className="bg-red-600 text-white text-lg px-4 py-2 whitespace-nowrap">-1001</Badge>
                </div>
                
                <div className={`flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <p className="font-semibold text-slate-900">
                      {getLocalizedText("Edit Section Suggestion", "הצעה לעריכת סעיף", "اقتراح تعديل قسم")}
                    </p>
                    <p className="text-sm text-slate-600">
                      {getLocalizedText("Cost to suggest editing existing section", "עלות להצעת עריכה לסעיף קיים", "تكلفة اقتراح تعديل قسم موجود")}
                    </p>
                  </div>
                  <Badge className="bg-red-600 text-white text-lg px-4 py-2 whitespace-nowrap">-200</Badge>
                </div>
                
                <div className={`flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <p className="font-semibold text-slate-900">
                      {getLocalizedText("New Section Suggestion", "הצעה לסעיף חדש", "اقتراح قسم جديد")}
                    </p>
                    <p className="text-sm text-slate-600">
                      {getLocalizedText("Cost to suggest adding new section", "עלות להצעת הוספת סעיף חדש", "تكلفة اقتراح إضافة قسم جديد")}
                    </p>
                  </div>
                  <Badge className="bg-red-600 text-white text-lg px-4 py-2 whitespace-nowrap">-350</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rewards Table */}
          <Card className="bg-white/80 backdrop-blur-sm border-green-200">
            <CardHeader className="bg-gradient-to-br from-green-50 to-emerald-50">
              <CardTitle className={`text-xl flex items-center gap-2 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                <ThumbsUp className="w-6 h-6 text-green-600" />
                {getLocalizedText("Rewards", "תגמולים", "المكافآت")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className={`flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <p className="font-semibold text-slate-900">
                      {getLocalizedText("Receive Pro Vote", "קבלת הצבעה בעד", "تلقي تصويت مع")}
                    </p>
                    <p className="text-sm text-slate-600">
                      {getLocalizedText("Each pro vote on your suggestion", "כל הצבעה בעד על ההצעה שלך", "كل تصويت مع على مقترحك")}
                    </p>
                  </div>
                  <Badge className="bg-green-600 text-white text-lg px-4 py-2 whitespace-nowrap">+10</Badge>
                </div>

                <div className={`flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <p className="font-semibold text-slate-900">
                      {getLocalizedText("Suggestion Accepted", "הצעה התקבלה", "المقترح مقبول")}
                    </p>
                    <p className="text-sm text-slate-600">
                      {getLocalizedText("Your suggestion passes consensus", "ההצעה שלך עוברת את הקונצנזוס", "مقترحك يتجاوز الإجماع")}
                    </p>
                  </div>
                  <Badge className="bg-blue-600 text-white text-lg px-4 py-2 whitespace-nowrap">+100</Badge>
                </div>

                <div className={`flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <p className="font-semibold text-slate-900">
                      {getLocalizedText("Decisive Vote", "הצבעה מכרעת", "تصويت حاسم")}
                    </p>
                    <p className="text-sm text-slate-600">
                      {getLocalizedText("Your vote caused acceptance", "ההצבעה שלך גרמה לאישור", "تصويتك تسبب في القبول")}
                    </p>
                  </div>
                  <Badge className="bg-purple-600 text-white text-lg px-4 py-2 whitespace-nowrap">+50</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* How Gamification Works */}
        <Card className="bg-gradient-to-br from-slate-50 to-blue-50 border-slate-200" id="gamification">
          <CardHeader className={isRTL ? 'text-right' : ''}>
            <CardTitle>
              {getLocalizedText("How Does Gamification Enable Noise Filtering and Create Incentives?", "איך הגיימיפיקציה מאפשרת סינון רעשים ויוצרת תמריצים?", "كيف يتيح التلعيب تصفية الضوضاء وخلق الحوافز؟")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Noise Filtering */}
              <div className={`p-4 bg-white rounded-lg border border-slate-200 ${isRTL ? 'text-right' : 'text-left'}`}>
                <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Badge className="bg-red-600">1</Badge>
                  {getLocalizedText("Noise Filtering Mechanism", "מנגנון סינון רעשים", "آلية تصفية الضوضاء")}
                </h4>
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold text-slate-800 mb-1">
                      {getLocalizedText("Entry Cost Creates Quality Threshold", "מחיר כניסה יוצר סף איכות", "تكلفة الدخول تخلق عتبة جودة")}
                    </p>
                    <p className="text-sm text-slate-600">
                      {getLocalizedText(
                        "The 200-350 point cost for creating suggestions acts as a 'spam filter' - users think twice before adding content. Only those who believe their suggestion has real value will invest their points.",
                        "העלות של 200-350 נקודות ליצירת הצעות משמשת כ'פילטר ספאם' - משתמשים חושבים פעמיים לפני הוספת תוכן. רק מי שמאמין שההצעה שלו בעלת ערך אמיתי ישקיע את הנקודות שלו.",
                        "تكلفة 200-350 نقطة لإنشاء مقترحات تعمل كـ'مرشح للبريد المزعج' - يفكر المستخدمون مرتين قبل إضافة محتوى. فقط أولئك الذين يعتقدون أن اقتراحهم له قيمة حقيقية سيستثمرون نقاطهم."
                      )}
                    </p>
                  </div>
                  
                  <div>
                    <p className="font-semibold text-slate-800 mb-1">
                      {getLocalizedText("Risk vs. Reward Calculation", "חישוב סיכון מול תמורה", "حساب المخاطرة مقابل المكافأة")}
                    </p>
                    <p className="text-sm text-slate-600">
                      {getLocalizedText(
                        "Before submitting, users must evaluate: 'Is my suggestion good enough to get support?' This cognitive step automatically filters out low-quality contributions.",
                        "לפני הגשה, משתמשים חייבים לשקול: 'האם ההצעה שלי מספיק טובה כדי לקבל תמיכה?' שלב קוגניטיבי זה מסנן אוטומטית תרומות באיכות נמוכה.",
                        "قبل الإرسال، يجب على المستخدمين التقييم: 'هل اقتراحي جيد بما يكفي للحصول على الدعم؟' هذه الخطوة المعرفية تصفي تلقائيًا المساهمات منخفضة الجودة."
                      )}
                    </p>
                  </div>
                  
                  <div>
                    <p className="font-semibold text-slate-800 mb-1">
                      {getLocalizedText("Self-Regulation Without Censorship", "ויסות עצמי ללא צנזורה", "التنظيم الذاتي بدون رقابة")}
                    </p>
                    <p className="text-sm text-slate-600">
                      {getLocalizedText(
                        "Unlike traditional moderation, no one decides what's 'spam' - the economic mechanism creates natural self-regulation. Users who spam lose points quickly.",
                        "בניגוד למודרציה מסורתית, אף אחד לא מחליט מה הוא 'ספאם' - המנגנון הכלכלי יוצר ויסות עצמי טבעי. משתמשים שמספמים מפסידים נקודות במהירות.",
                        "على عكس الإشراف التقليدي، لا يقرر أحد ما هو 'البريد المزعج' - الآلية الاقتصادية تخلق تنظيمًا ذاتيًا طبيعيًا. المستخدمون الذين يرسلون بريدًا مزعجًا يفقدون النقاط بسرعة."
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Positive Incentives */}
              <div className={`p-4 bg-white rounded-lg border border-slate-200 ${isRTL ? 'text-right' : 'text-left'}`}>
                <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Badge className="bg-green-600">2</Badge>
                  {getLocalizedText("Creating Positive Incentives", "יצירת תמריצים חיוביים", "خلق حوافز إيجابية")}
                </h4>
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold text-slate-800 mb-1">
                      {getLocalizedText("Reward for Community Support", "תגמול עבור תמיכה קהילתית", "مكافأة لدعم المجتمع")}
                    </p>
                    <p className="text-sm text-slate-600">
                      {getLocalizedText(
                        "Every pro vote earns +10 points - this incentivizes creating content that the community finds valuable. Quality is measured by community consensus, not a central authority.",
                        "כל הצבעה בעד מזכה ב-+10 נקודות - זה מעודד יצירת תוכן שהקהילה מוצאת בעל ערך. האיכות נמדדת בקונצנזוס קהילתי, לא ברשות מרכזית.",
                        "كل صوت مع يكسب +10 نقاط - هذا يحفز على إنشاء محتوى يجده المجتمع قيمًا. يتم قياس الجودة بالإجماع المجتمعي، وليس من قبل سلطة مركزية."
                      )}
                    </p>
                  </div>
                  
                  <div>
                    <p className="font-semibold text-slate-800 mb-1">
                      {getLocalizedText("Big Bonus for Acceptance", "בונוס גדול על קבלה", "مكافأة كبيرة للقبول")}
                    </p>
                    <p className="text-sm text-slate-600">
                      {getLocalizedText(
                        "+100 points for accepted suggestions creates a strong incentive to propose changes that truly improve the document. This aligns personal benefit with collective good.",
                        "+100 נקודות על הצעות שהתקבלו יוצר תמריץ חזק להציע שינויים שבאמת משפרים את המסמך. זה מיישר תועלת אישית עם טובת הכלל.",
                        "+100 نقطة للمقترحات المقبولة تخلق حافزًا قويًا لاقتراح تغييرات تحسن الوثيقة حقًا. هذا يوائم الفائدة الشخصية مع الصالح الجماعي."
                      )}
                    </p>
                  </div>
                  
                  <div>
                    <p className="font-semibold text-slate-800 mb-1">
                      {getLocalizedText("Building Reputation Score", "בניית ציון מוניטין", "بناء نقاط السمعة")}
                    </p>
                    <p className="text-sm text-slate-600">
                      {getLocalizedText(
                        "Points become a visible reputation metric - users with high points are recognized as valuable contributors. This creates social incentive beyond the numerical value.",
                        "הנקודות הופכות למדד מוניטין גלוי - משתמשים עם נקודות גבוהות מוכרים כתורמים בעלי ערך. זה יוצר תמריץ חברתי מעבר לערך המספרי.",
                        "النقاط تصبح مقياسًا للسمعة مرئيًا - يُعترف بالمستخدمين ذوي النقاط العالية كمساهمين قيمين. هذا يخلق حافزًا اجتماعيًا يتجاوز القيمة الرقمية."
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Key Insight */}
              <div className={`p-4 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg border border-amber-300 ${isRTL ? 'text-right' : 'text-left'}`}>
                <p className="font-bold text-amber-900 mb-2">
                  {getLocalizedText("Key Insight:", "תובנה מרכזית:", "رؤية رئيسية:")}
                </p>
                <p className="text-sm text-amber-800">
                  {getLocalizedText(
                    "The system doesn't punish participation - it rewards QUALITY participation. Even if you invest points, if your suggestions are valuable and get community support, you gain reputation and can continue contributing. Only spam and low-quality content results in point depletion.",
                    "המערכת לא מענישה השתתפות - היא מתגמלת השתתפות באיכות. גם אם אתה משקיע נקודות, אם ההצעות שלך בעלות ערך ומקבלות תמיכה קהילתית, אתה צובר מוניטין ויכול להמשיך לתרום. רק ספאם ותוכן באיכות נמוכה מביאים לדלדול נקודות.",
                    "النظام لا يعاقب المشاركة - بل يكافئ المشاركة الجيدة. حتى لو استثمرت نقاطًا، إذا كانت مقترحاتك قيمة وحصلت على دعم المجتمع، فإنك تكتسب سمعة ويمكنك الاستمرار في المساهمة. فقط البريد المزعج والمحتوى منخفض الجودة يؤدي إلى استنزاف النقاط."
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 p-6 bg-amber-50 border border-amber-200 rounded-lg">
          <p className={`text-sm text-amber-900 ${isRTL ? 'text-right' : 'text-left'}`}>
            <strong>
              {getLocalizedText("Note:", "שים לב:", "ملاحظة:")}
            </strong>{" "}
            {getLocalizedText(
              "The gamification system is optional and can be enabled or disabled per document by the administrator.",
              "מערכת הגיימיפיקציה היא אופציונלית וניתן להפעיל או לכבות אותה לכל מסמך על ידי המנהל.",
              "نظام التلعيب اختياري ويمكن تفعيله أو تعطيله لكل وثيقة من قبل المسؤول."
            )}
          </p>
        </div>
      </section>

      {/* Key Features */}
      <section className={`max-w-7xl mx-auto px-6 py-16 ${isRTL ? 'rtl' : 'ltr'}`}>
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            {getLocalizedText("Key Features", "תכונות מרכזיות", "الميزات الرئيسية")}
          </h2>
          <p className="text-slate-600">
            {getLocalizedText("What makes Consenz unique", "מה הופך את Consenz לייחודי", "ما الذي يجعل Consenz فريدًا")}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="bg-white/80 backdrop-blur-sm border-slate-200 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className={`flex items-start gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    {React.createElement(feature.icon, { className: "w-6 h-6 text-white" })}
                  </div>
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <h3 className="font-bold text-slate-900 mb-2">{feature.title}</h3>
                    <p className="text-sm text-slate-600">{feature.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Example: Consensus Calculation */}
      <section id="consensus-calculation" className={`max-w-7xl mx-auto px-6 py-16 ${isRTL ? 'rtl' : 'ltr'}`}>
        <Card className="bg-gradient-to-br from-slate-50 to-blue-50 border-slate-200">
          <CardHeader>
            <CardTitle className={`text-2xl ${isRTL ? 'text-right' : 'text-left'}`}>
              {getLocalizedText(
                "How is the Consensus Threshold Calculated?",
                "איך מחושב סף הקונצנזוס?",
                "كيف يتم حساب عتبة الإجماع؟"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-lg border border-slate-200">
                <div className={`flex items-start gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Badge className="bg-blue-600">1</Badge>
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <p className="font-semibold text-slate-900">
                      {getLocalizedText("Start with default value", "התחלה עם ערך ברירת מחדל", "البدء بقيمة افتراضية")}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      {getLocalizedText(
                        "Each document starts with a default consensus threshold (e.g., delta of 2 between pro and con votes)",
                        "כל מסמך מתחיל עם סף קונצנזוס ברירת מחדל (למשל, דלתא של 2 בין הצבעות בעד לנגד)",
                        "تبدأ كل وثيقة بعتبة إجماع افتراضية (مثل دلتا 2 بين أصوات مع وضد)"
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white rounded-lg border border-slate-200">
                <div className={`flex items-start gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Badge className="bg-indigo-600">2</Badge>
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <p className="font-semibold text-slate-900">
                      {getLocalizedText("Collect data from accepted suggestions", "איסוף נתונים מהצעות שהתקבלו", "جمع البيانات من المقترحات المقبولة")}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      {getLocalizedText(
                        "The system analyzes all accepted suggestions and calculates the average delta between pro and con votes",
                        "המערכת מנתחת את כל ההצעות שהתקבלו ומחשבת את הדלתא הממוצעת בין הצבעות בעד לנגד",
                        "يحلل النظام جميع المقترحات المقبولة ويحسب متوسط الدلتا بين أصوات مع وضد"
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white rounded-lg border border-slate-200">
                <div className={`flex items-start gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Badge className="bg-purple-600">3</Badge>
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <p className="font-semibold text-slate-900">
                      {getLocalizedText("Dynamic threshold update", "עדכון דינמי של הסף", "تحديث عتبة ديناميكي")}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      {getLocalizedText(
                        "Threshold updates automatically based on community behavior - if suggestions with high consensus are accepted, the threshold decreases",
                        "הסף מתעדכן אוטומטית על בסיס התנהגות הקהילה - אם הצעות עם קונצנזוס גבוה מתקבלות, הסף יורד",
                        "يتم تحديث العتبة تلقائيًا بناءً على سلوك المجتمع - إذا تم قبول مقترحات بإجماع عالٍ، تنخفض العتبة"
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className={`flex items-start gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <p className="font-semibold text-green-900">
                      {getLocalizedText("Result: Community-adapted algorithm", "תוצאה: אלגוריתם מותאם לקהילה", "النتيجة: خوارزمية متكيفة مع المجتمع")}
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      {getLocalizedText(
                        "The system learns the voting patterns of the community and adapts to the required consensus level",
                        "המערכת לומדת את דפוסי ההצבעה של הקהילה ומתאימה את עצמה לרמת הקונצנזוס הנדרשת",
                        "يتعلم النظام أنماط التصويت في المجتمع ويتكيف مع مستوى الإجماع المطلوب"
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Example */}
            <div className={`mt-8 ${isRTL ? 'text-right' : 'text-left'}`}>
              <h4 className="font-bold text-slate-900 mb-4">
                {getLocalizedText("Numerical Example", "דוגמה מספרית", "مثال رقمي")}
              </h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div className={`p-4 bg-blue-50 rounded-lg border border-blue-200 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <p className="text-sm font-medium text-blue-900 mb-2">
                    {getLocalizedText("Suggestion 1 Accepted", "הצעה 1 התקבלה", "المقترح 1 مقبول")}
                  </p>
                  <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <ThumbsUp className="w-4 h-4 text-green-600" />
                      <span className="font-bold">8</span>
                    </div>
                    <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <ThumbsDown className="w-4 h-4 text-red-600" />
                      <span className="font-bold">2</span>
                    </div>
                    <span className="text-sm text-slate-600">
                      {getLocalizedText("Delta: 6", "דלתא: 6", "دلتا: 6")}
                    </span>
                  </div>
                </div>

                <div className={`p-4 bg-purple-50 rounded-lg border border-purple-200 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <p className="text-sm font-medium text-purple-900 mb-2">
                    {getLocalizedText("Suggestion 2 Accepted", "הצעה 2 התקבלה", "المقترح 2 مقبول")}
                  </p>
                  <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <ThumbsUp className="w-4 h-4 text-green-600" />
                      <span className="font-bold">5</span>
                    </div>
                    <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <ThumbsDown className="w-4 h-4 text-red-600" />
                      <span className="font-bold">1</span>
                    </div>
                    <span className="text-sm text-slate-600">
                      {getLocalizedText("Delta: 4", "דלתא: 4", "دلتا: 4")}
                    </span>
                  </div>
                </div>
              </div>

              <div className={`mt-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200 ${isRTL ? 'text-right' : 'text-left'}`}>
                <p className="font-bold text-indigo-900 mb-2">
                  {getLocalizedText("New Threshold", "הסף החדש", "العتبة الجديدة")}
                </p>
                <p className="text-sm text-slate-700">
                  {getLocalizedText(
                    "Average: (6 + 4) / 2 = 5 → New threshold: 5",
                    "ממוצע: (6 + 4) / 2 = 5 → הסף החדש: 5",
                    "متوسط: (6 + 4) / 2 = 5 ← العتبة الجديدة: 5"
                  )}
                </p>
                <p className="text-xs text-slate-600 mt-2">
                  {getLocalizedText(
                    "New suggestions will need a delta of at least 5 to be auto-accepted",
                    "הצעות חדשות יצטרכו דלתא של לפחות 5 כדי להתקבל אוטומטית",
                    "ستحتاج المقترحات الجديدة إلى دلتا لا تقل عن 5 ليتم قبولها تلقائيًا"
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* CTA Section */}
      <section className={`max-w-7xl mx-auto px-6 py-16 ${isRTL ? 'rtl' : 'ltr'}`}>
        <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 border-0 text-white">
          <CardContent className="p-12 text-center">
            <h2 className="text-3xl font-bold mb-4">
              {getLocalizedText("Ready to Get Started?", "מוכן להתחיל?", "هل أنت مستعد للبدء؟")}
            </h2>
            <p className="text-blue-100 mb-8 text-lg">
              {getLocalizedText(
                "Join the community and start building consensus on shared documents",
                "הצטרף לקהילה והתחל לבנות קונצנזוס על מסמכים משותפים",
                "انضم إلى المجتمع وابدأ ببناء الإجماع على الوثائق المشتركة"
              )}
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link to={createPageUrl("Home")}>
                <Button size="lg" variant="secondary">
                  {getLocalizedText("Back to Home", "חזרה לדף הבית", "العودة إلى الصفحة الرئيسية")}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}