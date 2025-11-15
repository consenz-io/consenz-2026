import React, { createContext, useContext, useState, useEffect } from 'react';

const translations = {
  en: {
    // Navigation
    home: "Home",
    myDocuments: "My Documents",
    newDocument: "New Document",
    suggestions: "Suggestions",
    yourStats: "Your Stats",
    logout: "Logout",
    signIn: "Sign In",
    profile: "Profile",
    
    // Document
    addSection: "Add Section",
    editSection: "Edit Section",
    pendingEditSuggestion: "Pending Edit Suggestion",
    viewDetails: "View Details",
    proposedChanges: "Proposed Changes",
    lastEdited: "Last edited",
    comments: "Comments",
    admin: "Admin",
    versions: "Versions",
    
    // Suggestions
    newSuggestion: "New Suggestion",
    createNewTopic: "Create new topic",
    enterNewTopicName: "Enter new topic name...",
    topic: "Topic",
    content: "Content",
    explanation: "Explanation (optional)",
    createSuggestion: "Create Suggestion",
    cancel: "Cancel",
    
    // Voting
    votePro: "Vote Pro",
    voteCon: "Vote Con",
    proVotes: "Pro Votes",
    conVotes: "Con Votes",
    consensus: "Consensus",
    votesNeeded: "votes needed",
    passedConsensus: "Passed consensus!",
    cannotPass: "Cannot pass",
    
    // Status
    pending: "Pending",
    accepted: "Accepted",
    rejected: "Rejected",
    
    // Stats
    contributors: "Contributors",
    avgConsensus: "Avg Consensus",
    threshold: "Threshold",
    activeDocuments: "Active Documents",
    collaborators: "Collaborators",
    
    // Home
    democraticCollaboration: "Democratic Collaboration Platform",
    buildConsensus: "Build Consensus, Draft Together",
    platformDescription: "Collaborative platform for drafting policy documents, constitutions, and decisions through transparent voting and dynamic consensus algorithms.",
    getStarted: "Get Started",
    learnMore: "Learn More",
    recentDocuments: "Recent Documents",
    browseContribute: "Browse and contribute to ongoing collaborative drafts",
    
    // Misc
    by: "By",
    noSectionsYet: "No sections yet.",
    noTopicsYet: "No topics defined yet.",
    loading: "Loading...",
    insertSectionHere: "Insert section here",
    votingEnded: "Voting ended",
    remaining: "remaining",
    language: "Language",
    
    // Additional translations
    suggestNewSection: "Suggest New Section",
    suggestEditSection: "Suggest Edit to Section",
    enterContent: "Enter the content...",
    explainChange: "Explain why this change is needed...",
    creating: "Creating...",
    sectionContent: "Section Content",
    noSuggestionsYet: "No Suggestions Yet",
    beFirstToSuggest: "Be the first to suggest a change to this document",
    newSection: "New Section",
    left: "left",
    created: "Created",
    commentsCount: "Comments",
    replyingTo: "Replying to",
    writeReply: "Write a reply...",
    addComment: "Add comment...",
    postComment: "Post Comment",
    loadingComments: "Loading comments...",
    noCommentsYet: "No comments yet.",
    beFirstToComment: "Be the first to comment!",
    reply: "Reply",
    delete: "Delete",
    passedConsensusThreshold: "Passed consensus threshold!",
    fullAgreementNeeded: "Full agreement needed",
    votesNeededToPass: "{count} votes needed to pass",
    noDocumentsYet: "No Documents Yet",
    beFirstToCreate: "Be the first to create a collaborative document",
    documentNotFound: "Document not found",
    goHome: "Go Home",
    document: "Document",
    versionHistory: "Version History",
    compareVersions: "Compare Versions",
    cancelComparison: "Cancel Comparison",
    noPreviousVersions: "No Previous Versions",
    documentChangesSavedAutomatically: "Document changes are saved automatically as versions.",
    changeWithoutDescription: "Change without description",
    confirmRestoreVersion: "Are you sure you want to restore this version? The current version will be saved in history.",
    restoreVersion: "Restore Version",
    adminAccessRequired: "Admin access required",
    version: "Version",
    restoredFromVersion: "Restored from version {version}",
    viewInDocument: "View in Document",
    activitySummary: "Activity Summary",
    contributionDescription: "Your contribution and points history",
    pointsHistory: "Points History",
    noPointsHistory: "No points history yet",
    gamificationPoints: "Gamification Points",
    suggestionsCreated: "Suggestions Created",
    accountType: "Account Type",
    translateAll: "Translate All",
    translating: "Translating...",
    translateSection: "Translate Section",
    translatedFrom: "Translated from",
    points: "Points",
    navigation: "Navigation",
    costToCreate: "Cost to create suggestion:",
    yourPoints: "Your points:",
    originalContent: "Original Content:",
    cleanView: "Clean View",
    section: "Section",
    history: "History",
  },
  he: {
    // ניווט
    home: "בית",
    myDocuments: "המסמכים שלי",
    newDocument: "מסמך חדש",
    suggestions: "הצעות",
    yourStats: "הסטטיסטיקות שלך",
    logout: "התנתק",
    signIn: "התחבר",
    profile: "פרופיל",
    
    // מסמך
    addSection: "הוסף סעיף",
    editSection: "ערוך סעיף",
    pendingEditSuggestion: "הצעת עריכה ממתינה",
    viewDetails: "צפה בפרטים",
    proposedChanges: "שינויים מוצעים",
    lastEdited: "נערך לאחרונה",
    comments: "תגובות",
    admin: "ניהול",
    versions: "גרסאות",
    
    // הצעות
    newSuggestion: "הצעה חדשה",
    createNewTopic: "צור נושא חדש",
    enterNewTopicName: "הזן שם נושא חדש...",
    topic: "נושא",
    content: "תוכן",
    explanation: "הסבר (אופציונלי)",
    createSuggestion: "צור הצעה",
    cancel: "ביטול",
    
    // הצבעה
    votePro: "הצבע בעד",
    voteCon: "הצבע נגד",
    proVotes: "הצבעות בעד",
    conVotes: "הצבעות נגד",
    consensus: "קונצנזוס",
    votesNeeded: "הצבעות נדרשות",
    passedConsensus: "עבר את סף הקונסנזוס!",
    cannotPass: "לא יכול לעבור",
    
    // סטטוס
    pending: "ממתין",
    accepted: "התקבל",
    rejected: "נדחה",
    
    // סטטיסטיקות
    contributors: "משתתפים",
    avgConsensus: "קונצנזוס ממוצע",
    threshold: "סף",
    activeDocuments: "מסמכים פעילים",
    collaborators: "משתפי פעולה",
    
    // דף הבית
    democraticCollaboration: "פלטפורמת שיתוף פעולה דמוקרטי",
    buildConsensus: "בנו קונצנזוס, נסחו ביחד",
    platformDescription: "פלטפורמה לשיתוף פעולה לניסוח מסמכי מדיניות, חוקות והחלטות באמצעות הצבעה שקופה ואלגוריתמי קונצנזוס דינמיים.",
    getStarted: "התחל",
    learnMore: "למד עוד",
    recentDocuments: "מסמכים אחרונים",
    browseContribute: "עיין ותרום למסמכים משותפים מתמשכים",
    
    // שונות
    by: "על ידי",
    noSectionsYet: "אין סעיפים עדיין.",
    noTopicsYet: "אין נושאים עדיין.",
    loading: "טוען...",
    insertSectionHere: "הוסף סעיף כאן",
    votingEnded: "ההצבעה הסתיימה",
    remaining: "נותרו",
    language: "שפה",
    
    // תרגומים נוספים
    suggestNewSection: "הצע סעיף חדש",
    suggestEditSection: "הצע עריכה לסעיף",
    enterContent: "הזן את התוכן...",
    explainChange: "הסבר מדוע השינוי נדרש...",
    creating: "יוצר...",
    sectionContent: "תוכן הסעיף",
    noSuggestionsYet: "אין הצעות עדיין",
    beFirstToSuggest: "היה הראשון להציע שינוי למסמך זה",
    newSection: "סעיף חדש",
    left: "נותרו",
    created: "נוצר",
    commentsCount: "תגובות",
    replyingTo: "משיב ל",
    writeReply: "כתוב תגובה...",
    addComment: "הוסף תגובה...",
    postComment: "פרסם תגובה",
    loadingComments: "טוען תגובות...",
    noCommentsYet: "אין תגובות עדיין.",
    beFirstToComment: "היה הראשון להגיב!",
    reply: "השב",
    delete: "מחק",
    passedConsensusThreshold: "עבר את סף הקונסנזוס!",
    fullAgreementNeeded: "דרושה הסכמה מלאה",
    votesNeededToPass: "חסרים {count} תומכים לאישור",
    noDocumentsYet: "אין מסמכים עדיין",
    beFirstToCreate: "היה הראשון ליצור מסמך שיתופי",
    documentNotFound: "המסמך לא נמצא",
    goHome: "חזור לדף הבית",
    document: "מסמך",
    versionHistory: "היסטוריית גרסאות",
    compareVersions: "השווה גרסאות",
    cancelComparison: "בטל השוואה",
    noPreviousVersions: "אין גרסאות קודמות",
    documentChangesSavedAutomatically: "שינויים במסמך נשמרים אוטומטית כגרסאות.",
    changeWithoutDescription: "שינוי ללא תיאור",
    confirmRestoreVersion: "האם לשחזר גרסה זו? הגרסה הנוכחית תישמר בהיסטוריה.",
    restoreVersion: "שחזר גרסה",
    adminAccessRequired: "נדרשת הרשאת מנהל",
    version: "גרסה",
    restoredFromVersion: "שוחזר מגרסה {version}",
    viewInDocument: "צפה במסמך",
    activitySummary: "סיכום פעילות",
    contributionDescription: "התרומה שלך והיסטוריית הנקודות",
    pointsHistory: "היסטוריית נקודות",
    noPointsHistory: "אין עדיין היסטוריית נקודות",
    gamificationPoints: "נקודות גיימיפיקציה",
    suggestionsCreated: "הצעות שנוצרו",
    accountType: "סוג חשבון",
    translateAll: "תרגם הכל",
    translating: "מתרגם...",
    translateSection: "תרגם סעיף",
    translatedFrom: "תורגם מ",
    points: "נקודות",
    navigation: "ניווט",
    costToCreate: "עלות יצירת הצעה:",
    yourPoints: "הנקודות שלך:",
    originalContent: "התוכן המקורי:",
    cleanView: "תצוגה נקייה",
    section: "סעיף",
    history: "היסטוריה",
  },
  ar: {
    // التنقل
    home: "الرئيسية",
    myDocuments: "وثائقي",
    newDocument: "وثيقة جديدة",
    suggestions: "المقترحات",
    yourStats: "إحصائياتك",
    logout: "تسجيل الخروج",
    signIn: "تسجيل الدخول",
    profile: "الملف الشخصي",
    
    // الوثيقة
    addSection: "إضافة قسم",
    editSection: "تعديل القسم",
    pendingEditSuggestion: "اقتراح تعديل معلق",
    viewDetails: "عرض التفاصيل",
    proposedChanges: "التغييرات المقترحة",
    lastEdited: "آخر تعديل",
    comments: "التعليقات",
    admin: "الإدارة",
    versions: "الإصدارات",
    
    // المقترحات
    newSuggestion: "اقتراح جديد",
    createNewTopic: "إنشاء موضوع جديد",
    enterNewTopicName: "أدخل اسم الموضوع الجديد...",
    topic: "الموضوع",
    content: "المحتوى",
    explanation: "الشرح (اختياري)",
    createSuggestion: "إنشاء اقتراح",
    cancel: "إلغاء",
    
    // التصويت
    votePro: "صوت مع",
    voteCon: "صوت ضد",
    proVotes: "أصوات مع",
    conVotes: "أصوات ضد",
    consensus: "الإجماع",
    votesNeeded: "أصوات مطلوبة",
    passedConsensus: "تم تجاوز عتبة الإجماع!",
    cannotPass: "لا يمكن التمرير",
    
    // الحالة
    pending: "معلق",
    accepted: "مقبول",
    rejected: "مرفوض",
    
    // الإحصائيات
    contributors: "المساهمون",
    avgConsensus: "متوسط الإجماع",
    threshold: "العتبة",
    activeDocuments: "الوثائق النشطة",
    collaborators: "المتعاونون",
    
    // الصفحة الرئيسية
    democraticCollaboration: "منصة التعاون الديمقراطي",
    buildConsensus: "بناء الإجماع، صياغة معًا",
    platformDescription: "منصة تعاونية لصياغة وثائق السياسة والدساتير والقرارات من خلال التصويت الشفاف وخوارزميات الإجماع الديناميكية.",
    getStarted: "ابدأ",
    learnMore: "تعلم المزيد",
    recentDocuments: "الوثائق الأخيرة",
    browseContribute: "تصفح وساهم في المسودات التعاونية الجارية",
    
    // متنوع
    by: "بواسطة",
    noSectionsYet: "لا توجد أقسام حتى الآن.",
    noTopicsYet: "لا توجد مواضيع محددة بعد.",
    loading: "جاري التحميل...",
    insertSectionHere: "أدخل قسم هنا",
    votingEnded: "انتهى التصويت",
    remaining: "متبقية",
    language: "اللغة",
    
    // Additional translations
    suggestNewSection: "اقتراح قسم جديد",
    suggestEditSection: "اقتراح تعديل على القسم",
    enterContent: "أدخل المحتوى...",
    explainChange: "اشرح لماذا هذا التغيير مطلوب...",
    creating: "جارٍ الإنشاء...",
    noSuggestionsYet: "لا توجد مقترحات بعد",
    beFirstToSuggest: "كن أول من يقترح تغييرًا على هذا المستند",
    newSection: "قسم جديد",
    left: "متبقية",
    created: "تم الإنشاء",
    commentsCount: "التعليقات",
    replyingTo: "الرد على",
    writeReply: "اكتب ردًا...",
    addComment: "أضف تعليقًا...",
    postComment: "نشر التعليق",
    loadingComments: "جارٍ تحميل التعليقات...",
    noCommentsYet: "لا توجد تعليقات حتى الآن.",
    beFirstToComment: "كن أول من يعلق!",
    reply: "رد",
    delete: "حذف",
    passedConsensusThreshold: "تجاوز عتبة الإجماع!",
    fullAgreementNeeded: "مطلوب اتفاق كامل",
    votesNeededToPass: "مطلوب {count} أصوات للتمرير",
    noDocumentsYet: "لا توجد مستندات بعد",
    beFirstToCreate: "كن أول من ينشئ مستندًا تعاونيًا",
    documentNotFound: "المستند غير موجود",
    goHome: "العودة إلى الصفحة الرئيسية",
    document: "المستند",
    versionHistory: "سجل الإصدارات",
    compareVersions: "مقارنة الإصدارات",
    cancelComparison: "إلغاء المقارنة",
    noPreviousVersions: "لا توجد إصدارات سابقة",
    documentChangesSavedAutomatically: "يتم حفظ تغييرات المستند تلقائيًا كإصدارات.",
    changeWithoutDescription: "تغيير بدون وصف",
    confirmRestoreVersion: "هل أنت متأكد أنك تريد استعادة هذا الإصدار؟ سيتم حفظ الإصدار الحالي في السجل.",
    restoreVersion: "استعادة الإصدار",
    adminAccessRequired: "مطلوب وصول المسؤول",
    version: "إصدار",
    restoredFromVersion: "تم الاستعادة من الإصدار {version}",
    viewInDocument: "عرض في المستند",
    activitySummary: "ملخص النشاط",
    contributionDescription: "مساهمتك وتاريخ النقاط",
    pointsHistory: "تاريخ النقاط",
    noPointsHistory: "لا يوجد تاريخ نقاط حتى الآن",
    gamificationPoints: "نقاط التلعيب",
    suggestionsCreated: "المقترحات المنشأة",
    accountType: "نوع الحساب",
    translateAll: "ترجمة الكل",
    translating: "جاري الترجمة...",
    translateSection: "ترجمة القسم",
    translatedFrom: "مترجم من",
    points: "نقاط",
    navigation: "التنقل",
    costToCreate: "تكلفة إنشاء اقتراح:",
    yourPoints: "نقاطك:",
    originalContent: "المحتوى الأصلي:",
    cleanView: "عرض نظيف",
    section: "القسم",
    history: "التاريخ",
  }
};

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('consenz_language') || 'he';
  });

  useEffect(() => {
    localStorage.setItem('consenz_language', language);
    document.documentElement.dir = language === 'en' ? 'ltr' : 'rtl';
    document.documentElement.lang = language;
  }, [language]);

  const t = (key) => {
    return translations[language][key] || key;
  };

  const isRTL = language === 'he' || language === 'ar';

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
};