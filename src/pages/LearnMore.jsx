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
  const { t, isRTL } = useLanguage();
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      title: isRTL ? "יצירת מסמך" : "Create a Document",
      description: isRTL 
        ? "התחל על ידי יצירת מסמך שיתופי חדש. הגדר את הנושאים העיקריים והסעיפים הראשוניים."
        : "Start by creating a new collaborative document. Define main topics and initial sections.",
      icon: FileText,
      color: "from-blue-500 to-indigo-500",
      steps: isRTL ? [
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
      title: isRTL ? "הצעת שינויים" : "Suggest Changes",
      description: isRTL
        ? "כל משתמש יכול להציע שינויים למסמך - עריכת סעיפים קיימים או הוספת סעיפים חדשים."
        : "Any user can suggest changes to the document - editing existing sections or adding new ones.",
      icon: Edit3,
      color: "from-purple-500 to-pink-500",
      steps: isRTL ? [
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
      title: isRTL ? "הצבעה על הצעות" : "Vote on Suggestions",
      description: isRTL
        ? "המשתמשים מצביעים על הצעות - בעד או נגד. ההצעה עוברת כאשר היא עוברת את סף הקונצנזוס."
        : "Users vote on suggestions - pro or con. The suggestion passes when it reaches the consensus threshold.",
      icon: Vote,
      color: "from-green-500 to-teal-500",
      steps: isRTL ? [
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
      title: isRTL ? "דיון ותגובות" : "Discussion & Comments",
      description: isRTL
        ? "השתתף בדיונים, הוסף טיעונים בעד ונגד, והגב לתגובות של משתמשים אחרים."
        : "Participate in discussions, add pro and con arguments, and reply to other users' comments.",
      icon: MessageSquare,
      color: "from-orange-500 to-red-500",
      steps: isRTL ? [
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
      title: isRTL ? "קונצנזוס דינמי" : "Dynamic Consensus",
      description: isRTL
        ? "האלגוריתם מחשב סף קונצנזוס דינמי על בסיס היסטוריית ההצעות שהתקבלו במסמך."
        : "The algorithm calculates a dynamic consensus threshold based on the history of accepted suggestions.",
      icon: TrendingUp,
      color: "from-indigo-500 to-purple-500",
      steps: isRTL ? [
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
      title: isRTL ? "שיתוף פעולה דמוקרטי" : "Democratic Collaboration",
      description: isRTL 
        ? "כל משתמש יכול להציע שינויים והקהילה מחליטה יחד"
        : "Every user can suggest changes and the community decides together"
    },
    {
      icon: TrendingUp,
      title: isRTL ? "אלגוריתם קונצנזוס חכם" : "Smart Consensus Algorithm",
      description: isRTL
        ? "סף דינמי שמתאים את עצמו להיסטוריית ההצבעות"
        : "Dynamic threshold that adapts to voting history"
    },
    {
      icon: CheckCircle,
      title: isRTL ? "אישור אוטומטי" : "Automatic Approval",
      description: isRTL
        ? "הצעות מאושרות אוטומטית כשהן עוברות את הסף"
        : "Suggestions are auto-approved when they pass the threshold"
    },
    {
      icon: MessageSquare,
      title: isRTL ? "דיון מובנה" : "Structured Discussion",
      description: isRTL
        ? "טיעונים בעד ונגד, תגובות ותשובות למסמך ולהצעות"
        : "Pro and con arguments, comments and replies on documents and suggestions"
    },
    {
      icon: Clock,
      title: isRTL ? "ניהול זמן הצבעה" : "Voting Time Management",
      description: isRTL
        ? "הגדר פרק זמן להצבעה על הצעות"
        : "Set time period for voting on suggestions"
    },
    {
      icon: FileText,
      title: isRTL ? "היסטוריית גרסאות" : "Version History",
      description: isRTL
        ? "מעקב אחר כל השינויים במסמך עם אפשרות שחזור"
        : "Track all document changes with restore capability"
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
              {isRTL ? "חזרה לדף הבית" : "Back to Home"}
            </Button>
          </Link>
          
          <div className={`text-center space-y-6 ${isRTL ? 'rtl' : 'ltr'}`}>
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900">
              {isRTL ? "איך Consenz עובד?" : "How Consenz Works?"}
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              {isRTL 
                ? "פלטפורמה לשיתוף פעולה דמוקרטי בניסוח מסמכי מדיניות, חוקות והחלטות באמצעעת אלגוריתמי קונצנזוס דינמיים"
                : "A platform for democratic collaboration in drafting policy documents, constitutions, and decisions using dynamic consensus algorithms"}
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Tutorial */}
      <section className={`max-w-7xl mx-auto px-6 py-16 ${isRTL ? 'rtl' : 'ltr'}`}>
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            {isRTL ? "מדריך שלב אחר שלב" : "Step-by-Step Guide"}
          </h2>
          <p className="text-slate-600">
            {isRTL ? "למד איך להשתמש במערכת בחמישה שלבים פשוטים" : "Learn how to use the system in five simple steps"}
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
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-xl">
          <CardHeader>
            <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${steps[activeStep].color} flex items-center justify-center shadow-lg`}>
                {React.createElement(steps[activeStep].icon, { className: "w-8 h-8 text-white" })}
              </div>
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <CardTitle className="text-2xl">{steps[activeStep].title}</CardTitle>
                <p className="text-slate-600 mt-1">{steps[activeStep].description}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {steps[activeStep].steps.map((stepText, index) => (
                <div key={index} className={`flex items-start gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br ${steps[activeStep].color} flex items-center justify-center text-white font-bold shadow-lg`}>
                    {index + 1}
                  </div>
                  <p className={`text-slate-700 pt-1 ${isRTL ? 'text-right' : 'text-left'}`}>{stepText}</p>
                </div>
              ))}
            </div>

            {/* Navigation Buttons */}
            <div className={`flex justify-between mt-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Button
                variant="outline"
                onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
                disabled={activeStep === 0}
                className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                {isRTL ? <ChevronRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                {isRTL ? "הקודם" : "Previous"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setActiveStep(Math.min(steps.length - 1, activeStep + 1))}
                disabled={activeStep === steps.length - 1}
                className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                {isRTL ? "הבא" : "Next"}
                {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Visual Flow Diagram */}
      <section className={`max-w-7xl mx-auto px-6 py-16 ${isRTL ? 'rtl' : 'ltr'}`}>
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            {isRTL ? "תהליך העבודה" : "The Workflow"}
          </h2>
          <p className="text-slate-600">
            {isRTL ? "הבנה ויזואלית של תהליך הקונצנזוס" : "Visual understanding of the consensus process"}
          </p>
        </div>

        <div className={`grid md:grid-cols-5 gap-4 ${isRTL ? 'rtl' : 'ltr'}`}>
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="w-12 h-12 mx-auto mb-4 bg-blue-600 rounded-full flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <h3 className={`font-bold text-slate-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                {isRTL ? "יצירה" : "Create"}
              </h3>
              <p className={`text-sm text-slate-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                {isRTL ? "יצירת מסמך ותוכן ראשוני" : "Create document and initial content"}
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
                {isRTL ? "הצעה" : "Suggest"}
              </h3>
              <p className={`text-sm text-slate-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                {isRTL ? "הצעת שינויים למסמך" : "Propose changes to document"}
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
                {isRTL ? "הצבעה" : "Vote"}
              </h3>
              <p className={`text-sm text-slate-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                {isRTL ? "הצבעה בעד או נגד" : "Vote pro or con"}
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
                {isRTL ? "דיון" : "Discuss"}
              </h3>
              <p className={`text-sm text-slate-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                {isRTL ? "טיעונים ותגובות" : "Arguments and comments"}
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
                {isRTL ? "קבלה" : "Accept"}
              </h3>
              <p className={`text-sm text-slate-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                {isRTL ? "אישור אוטומטי" : "Auto approval"}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Key Features */}
      <section className={`max-w-7xl mx-auto px-6 py-16 ${isRTL ? 'rtl' : 'ltr'}`}>
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            {isRTL ? "תכונות מרכזיות" : "Key Features"}
          </h2>
          <p className="text-slate-600">
            {isRTL ? "מה הופך את Consenz לייחודי" : "What makes Consenz unique"}
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
              {isRTL ? "איך מחושב סף הקונצנזוס?" : "How is the Consensus Threshold Calculated?"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-lg border border-slate-200">
                <div className={`flex items-start gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Badge className="bg-blue-600">1</Badge>
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <p className="font-semibold text-slate-900">
                      {isRTL ? "התחלה עם ערך ברירת מחדל" : "Start with default value"}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      {isRTL 
                        ? "כל מסמך מתחיל עם סף קונצנזוס ברירת מחדל (למשל, דלתא של 2 בין הצבעות בעד לנגד)"
                        : "Each document starts with a default consensus threshold (e.g., delta of 2 between pro and con votes)"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white rounded-lg border border-slate-200">
                <div className={`flex items-start gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Badge className="bg-indigo-600">2</Badge>
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <p className="font-semibold text-slate-900">
                      {isRTL ? "איסוף נתונים מהצעות שהתקבלו" : "Collect data from accepted suggestions"}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      {isRTL
                        ? "המערכת מנתחת את כל ההצעות שהתקבלו ומחשבת את הדלתא הממוצעת בין הצבעות בעד לנגד"
                        : "The system analyzes all accepted suggestions and calculates the average delta between pro and con votes"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white rounded-lg border border-slate-200">
                <div className={`flex items-start gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Badge className="bg-purple-600">3</Badge>
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <p className="font-semibold text-slate-900">
                      {isRTL ? "עדכון דינמי של הסף" : "Dynamic threshold update"}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      {isRTL
                        ? "הסף מתעדכן אוטומטית על בסיס התנהגות הקהילה - אם הצעות עם קונצנזוס גבוה מתקבלות, הסף יורד"
                        : "Threshold updates automatically based on community behavior - if suggestions with high consensus are accepted, the threshold decreases"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className={`flex items-start gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <p className="font-semibold text-green-900">
                      {isRTL ? "תוצאה: אלגוריתם מותאם לקהילה" : "Result: Community-adapted algorithm"}
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      {isRTL
                        ? "המערכת לומדת את דפוסי ההצבעה של הקהילה ומתאימה את עצמה לרמת הקונצנזוס הנדרשת"
                        : "The system learns the voting patterns of the community and adapts to the required consensus level"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Example */}
            <div className={`mt-8 ${isRTL ? 'text-right' : 'text-left'}`}>
              <h4 className="font-bold text-slate-900 mb-4">
                {isRTL ? "דוגמה מספרית" : "Numerical Example"}
              </h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div className={`p-4 bg-blue-50 rounded-lg border border-blue-200 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <p className="text-sm font-medium text-blue-900 mb-2">
                    {isRTL ? "הצעה 1 התקבלה" : "Suggestion 1 Accepted"}
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
                      {isRTL ? "דלתא: 6" : "Delta: 6"}
                    </span>
                  </div>
                </div>

                <div className={`p-4 bg-purple-50 rounded-lg border border-purple-200 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <p className="text-sm font-medium text-purple-900 mb-2">
                    {isRTL ? "הצעה 2 התקבלה" : "Suggestion 2 Accepted"}
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
                      {isRTL ? "דלתא: 4" : "Delta: 4"}
                    </span>
                  </div>
                </div>
              </div>

              <div className={`mt-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200 ${isRTL ? 'text-right' : 'text-left'}`}>
                <p className="font-bold text-indigo-900 mb-2">
                  {isRTL ? "הסף החדש" : "New Threshold"}
                </p>
                <p className="text-sm text-slate-700">
                  {isRTL 
                    ? "ממוצע: (6 + 4) / 2 = 5 → הסף החדש: 5"
                    : "Average: (6 + 4) / 2 = 5 → New threshold: 5"}
                </p>
                <p className="text-xs text-slate-600 mt-2">
                  {isRTL
                    ? "הצעות חדשות יצטרכו דלתא של לפחות 5 כדי להתקבל אוטומטית"
                    : "New suggestions will need a delta of at least 5 to be auto-accepted"}
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
              {isRTL ? "מוכן להתחיל?" : "Ready to Get Started?"}
            </h2>
            <p className="text-blue-100 mb-8 text-lg">
              {isRTL 
                ? "הצטרף לקהילה והתחל לבנות קונצנזוס על מסמכים משותפים"
                : "Join the community and start building consensus on shared documents"}
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link to={createPageUrl("Home")}>
                <Button size="lg" variant="secondary">
                  {isRTL ? "חזרה לדף הבית" : "Back to Home"}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}