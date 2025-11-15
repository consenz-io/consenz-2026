import React, { useState } from "react";
import { Link } from "react-router-dom";
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
        "בחר بين עריכת סעיף קיים להוספת סעיף חדש",
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
              <ArrowLeft className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {getLocalizedText("Back to Home", "חזרה לדף הבית", "العودة إلى الصفحة الرئيسية")}
            </Button>
          </Link>
          
          <div className={`text-center space-y-6 ${isRTL ? 'rtl' : 'ltr'}`}>
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900">
              {getLocalizedText("How Consenz Works?", "איך Consenz עובד?", "كيف يعمل Consenz؟")}
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              {getLocalizedText(
                "A platform for democratic collaboration in drafting policy documents, constitutions, and decisions using dynamic consensus algorithms",
                "פלטפורמה לשיתוף פעולה דמוקרטי בניסוח מסמכי מדיניות, חוקות והחלטות באמצעעת אלגוריתמי קונצנזוס דינמיים",
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

      {/* Visual Flow Diagram */}
      <section className={`max-w-7xl mx-auto px-6 py-16 ${isRTL ? 'rtl' : 'ltr'}`}>
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            {getLocalizedText("The Workflow", "תהליך העבודה", "سير العمل")}
          </h2>
          <p className="text-slate-600">
            {getLocalizedText(
              "Visual understanding of the consensus process",
              "הבנה ויזואלית של תהליך הקונצנזוס",
              "فهم بصري لعملية الإجماع"
            )}
          </p>
        </div>

        <div className={`grid md:grid-cols-5 gap-4 ${isRTL ? 'rtl' : 'ltr'}`}>
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="w-12 h-12 mx-auto mb-4 bg-blue-600 rounded-full flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <h3 className={`font-bold text-slate-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                {getLocalizedText("Create", "יצירה", "إنشاء")}
              </h3>
              <p className={`text-sm text-slate-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                {getLocalizedText("Create document and initial content", "יצירת מסמך ותוכן ראשוני", "إنشاء وثيقة ومحتوى أولي")}
              </p>
            </CardContent>
          </Card>

          <div className="flex items-center justify-center">
            {isRTL ? <ArrowLeft className="w-8 h-8 text-slate-400" /> : <ArrowRight className="w-8 h-8 text-slate-400" />}
          </div>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6">
              <div className="w-12 h-12 mx-auto mb-4 bg-purple-600 rounded-full flex items-center justify-center">
                <Edit3 className="w-6 h-6 text-white" />
              </div>
              <h3 className={`font-bold text-slate-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                {getLocalizedText("Suggest", "הצעה", "اقتراح")}
              </h3>
              <p className={`text-sm text-slate-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                {getLocalizedText("Propose changes to document", "הצעת שינויים למסמך", "اقتراح تغييرات على الوثيقة")}
              </p>
            </CardContent>
          </Card>

          <div className="flex items-center justify-center">
            {isRTL ? <ArrowLeft className="w-8 h-8 text-slate-400" /> : <ArrowRight className="w-8 h-8 text-slate-400" />}
          </div>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6">
              <div className="w-12 h-12 mx-auto mb-4 bg-green-600 rounded-full flex items-center justify-center">
                <Vote className="w-6 h-6 text-white" />
              </div>
              <h3 className={`font-bold text-slate-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                {getLocalizedText("Vote", "הצבעה", "تصويت")}
              </h3>
              <p className={`text-sm text-slate-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                {getLocalizedText("Vote pro or con", "הצבעה בעד או נגד", "التصويت مع أو ضد")}
              </p>
            </CardContent>
          </Card>

          <div className="flex items-center justify-center">
            {isRTL ? <ArrowLeft className="w-8 h-8 text-slate-400" /> : <ArrowRight className="w-8 h-8 text-slate-400" />}
          </div>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="p-6">
              <div className="w-12 h-12 mx-auto mb-4 bg-orange-600 rounded-full flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <h3 className={`font-bold text-slate-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                {getLocalizedText("Discuss", "דיון", "نقاش")}
              </h3>
              <p className={`text-sm text-slate-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                {getLocalizedText("Arguments and comments", "טיעונים ותגובות", "حجج وتعليقات")}
              </p>
            </CardContent>
          </Card>

          <div className="flex items-center justify-center">
            {isRTL ? <ArrowLeft className="w-8 h-8 text-slate-400" /> : <ArrowRight className="w-8 h-8 text-slate-400" />}
          </div>

          <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
            <CardContent className="p-6">
              <div className="w-12 h-12 mx-auto mb-4 bg-indigo-600 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <h3 className={`font-bold text-slate-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                {getLocalizedText("Accept", "קבלה", "قبول")}
              </h3>
              <p className={`text-sm text-slate-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                {getLocalizedText("Auto approval", "אישור אוטומטי", "الموافقة التلقائية")}
              </p>
            </CardContent>
          </Card>
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
      <section className={`max-w-7xl mx-auto px-6 py-16 ${isRTL ? 'rtl' : 'ltr'}`}>
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