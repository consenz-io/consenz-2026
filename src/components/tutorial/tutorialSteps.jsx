/**
 * TutorialStep interface:
 * {
 *   id: string,
 *   type: 'explain' | 'practice' | 'encourage' | 'closing',
 *   targetSelector: string,
 *   tooltipPosition: 'top' | 'bottom' | 'left' | 'right' | 'auto',
 *   heading: string,           // i18n key
 *   body: string,              // i18n key (empty string = no body)
 *   successMessage?: string,   // i18n key
 *   completionEvent?: string,
 *   table?: Array<{label: string, value: string}>
 * }
 *
 * Note: 'encourage' type allows users to click "Next" without completing any action —
 * it's a motivational tooltip that suggests optional interactions but doesn't block progression.
 */

export const tutorialStrings = {
  he: {
    'home.intro.success': 'מעולה, בואו נתחיל',
    'group.intro.success': 'מעולה, בואו נתחיל',
    'home.groups.heading': 'קבוצה היא מרחב שיתוף פעולה',
    'home.groups.body': 'חברי הקבוצה כותבים מסמכים ביחד ומצביעים על כל הצעה. לחצו על קבוצה כדי להתחיל להשתתף.',
    'group.explain.heading': 'ברוכים הבאים לקבוצה',
    'group.explain.body': 'קבוצה היא מרחב שיתוף פעולה — כאן כותבים מסמכים ביחד, מציעים שינויים ומצביעים. החברים מעצבים את התוכן יחד.',
    'group.docs.heading': 'מסמכי הקבוצה',
    'group.docs.body': 'לחצו על מסמך כדי להמשיך בהדרכה.',
    'doc.title.heading': 'להבין את ההקשר',
    'doc.title.body': 'שם המסמך ומטרתו. קריאת הרקע תיתן תמונה מלאה לפני הצעת שינויים.',
    'doc.counters.heading': 'הדופק של המסמך',
    'doc.counters.body': 'מספר השותפים הפעילים, הדיונים, רמת ההסכמה והגרסאות שאושרו. לחצו על כל נתון לפרטים.',
    'editclause.explain.heading': 'כל סעיף פתוח לשינוי',
    'editclause.explain.body': 'לא מסכימים עם נוסח קיים? כל סעיף פתוח להצעות עריכה או מחיקה. הקהילה תצביע, ואם תזכו לתמיכה — המסמך יתעדכן אוטומטית.',
    'editclause.buttons.heading': 'איך מציעים שינוי?',
    'editclause.buttons.body': 'במחשב: העבירו את העכבר מעל הסעיף. בנייד: לחצו עליו. כפתורי העריכה והמחיקה יופיעו מיד.',
    'browse.explain.heading': 'כמה הצעות לכל סעיף',
    'browse.explain.body': 'פורסמו הצעות לשינוי הסעיף? חצי דפדוף יאפשרו לעבור ביניהן ולהשוות. כך תבחרו את ההצעה הטובה ביותר.',
    'vote.explain.heading': 'הקול שלכם קובע',
    'vote.explain.body': 'הצביעו בעד כדי לקרב הצעה לאישור, או נגד כדי להרחיק אותה. אפשר גם להצביע נגד סעיף קיים כדי לקדם את מחיקתו. כל קול משפיע על הניסוח הסופי.',
    'support.threshold.explain.heading': 'רף התומכים הדרוש',
    'support.threshold.explain.body': 'כמה הצבעות חסרות לאישור הצעה — או, בסעיף קיים, למחיקתו. ככל שהתמיכה בגרסה הנוכחית גבוהה יותר, כך הרף גבוה יותר.',
    'newclause.explain.heading': 'חסר סעיף שלם?',
    'newclause.explain.body': 'רעיון חדש שלא במסמך? הוסיפו הצעה לסעיף חדש. במחשב: העמידו את העכבר בין שני סעיפים. בנייד: לחצו על הרווח ביניהם. כפתור \'הוספת סעיף\' יופיע.',
    'consensus.meter.explain.heading': 'מד הקונסנזוס',
    'consensus.meter.explain.body': 'מציג את רמת ההסכמה במסמך. ככל שהיא גבוהה יותר — הרף לאישור הצעה גבוה יותר. לחצו לפרטים.',
    'versions.counter.explain.heading': 'היסטוריית הגרסאות',
    'versions.counter.explain.body': 'כל הצעה שהתקבלה יצרה גרסה חדשה. הספרה מייצגת את כמות הגרסאות שאושרו. נלחץ עליה כדי לראות את ההיסטוריה.',
    'versions.browse.explain.heading': 'איך המסמך התפתח',
    'versions.browse.explain.body': 'לחיצה על "גרסה קודמת" תציג את המסמך בשלב קודם. כל גרסה מייצגת הסכמה שהקהילה הגיעה אליה — התמיכה גדלה מגרסה לגרסה.',
    'versions.change.explain.heading': 'מה השתנה?',
    'versions.change.explain.body': 'ירוק = מילים שנוספו, אדום = מילים שנמחקו. כך תדעו בדיוק מה השתנה בכל גרסה.',
    'sidebar.explain.heading': 'ההצעה שהובילה לשינוי',
    'sidebar.explain.body': 'כאן תראו את הדיון המלא — מה הציעו, כמה הצביעו, והטיעונים. כל שינוי עבר דיון והצבעה קהילתית.',
    'points.ranking.explain.heading': 'הניקוד שלך משקף תרומה',
    'points.ranking.explain.body': 'הניקוד מסנן רעש — הגשת הצעה עולה נקודות. אבל כשהקהילה תומכת בהצעה שלך, אתה מחזיר הרבה יותר. ככל שהתרומות משפיעות יותר — הניקוד גדל.',
    'points.ranking.explain.learnMore': 'איך צוברים נקודות?',
    'tour.summary.heading': 'מצוין! אתם מוכנים להשפיע',
    'tour.summary.body': 'עברתם על כל הכלים: קריאת סעיפים, השוואת הצעות, הצבעה, ומעקב אחר היסטוריית הגרסאות. עכשיו הכוח לעצב את המסמך בידיים שלכם.',
    'welcome.overlay.heading': 'ברוכים הבאים לסיור בפלטפורמה',
    'welcome.overlay.body': 'סיור קצר על השימוש בפלטפורמה: קריאת מסמכים, הצעת שינויים, הצבעה, ומעקב אחר ההיסטוריה. נתחיל מעמוד הבית.',
    'welcome.overlay.cta': 'בואו נתחיל',
    'welcome.intro.prepare.heading': 'ברוכים הבאים לסיור',
    'welcome.intro.prepare.body': 'בקבוצה תוכלו לדון, להשתתף בכתיבה משותפת, ולראות איך הקהילה בונה מסמכים ביחד. נתחיל בהבנת מה זו קבוצה.',
    'nav.restart': 'סיור בפלטפורמה',
    'signup.prompt.heading': 'כדי להמשיך צריך להירשם',
    'signup.prompt.body': 'הרשמה חינמית שלוקחת שניות. אחריה תחזרו בדיוק לכאן.',
    'signup.prompt.cta': 'הרשמה',
  },
  ar: {
    'home.intro.success': 'رائع، لنبدأ',
    'group.intro.success': 'رائع، لنبدأ',
    'home.groups.heading': 'المجموعة هي فضاء للتعاون',
    'home.groups.body': 'يكتب الأعضاء وثائق معاً ويصوتون على كل اقتراح. اضغطوا على مجموعة للمشاركة.',
    'group.explain.heading': 'مرحباً بكم في المجموعة',
    'group.explain.body': 'المجموعة فضاء للتعاون — هنا تُكتب الوثائق معاً، تُقترح التعديلات وتُتخذ القرارات بالتصويت.',
    'group.docs.heading': 'وثائق المجموعة',
    'group.docs.body': 'اضغطوا على وثيقة للدخول والمتابعة.',
    'doc.title.heading': 'عنوان الوثيقة ووصفها',
    'doc.title.body': 'اسم الوثيقة وهدفها. اقرأوا الخلفية قبل التعمق في البنود.',
    'doc.counters.heading': 'بيانات الوثيقة في لمحة سريعة',
    'doc.counters.body': 'المشاركون النشطون، التعليقات، مستوى التوافق، والإصدارات المقبولة. اضغطوا على كل رقم للتفاصيل.',
    'editclause.explain.heading': 'كل بند قابل للتعديل',
    'editclause.explain.body': 'لا توافقون على صياغة؟ يمكنكم اقتراح تعديل أي بند أو حذفه. المجتمع يصوّت، وإذا وافق — يُدرج في الوثيقة.',
    'editclause.buttons.heading': 'كيف أقترح تغييراً؟',
    'editclause.buttons.body': 'على الحاسوب: مرروا المؤشر فوق البند. على الجوال: اضغطوا عليه. ستظهر أزرار التعديل والحذف فوراً.',
    'browse.explain.heading': 'لكل بند عدة نسخ',
    'browse.explain.body': 'نُشرت اقتراحات للبند؟ ستظهر أسهم للتنقل بينها ومقارنتها. هكذا تختارون الصياغة الأفضل.',
    'vote.explain.heading': 'تصويتكم يشكّل الوثيقة',
    'vote.explain.body': 'صوّتوا "مع" لتقريب مقترح من القبول، أو "ضد" لإبعاده. يمكنكم أيضاً التصويت ضد بند قائم لتعزيز حذفه. كل صوت يؤثر على الصيغة النهائية.',
    'support.threshold.explain.heading': 'عتبة التأييد المطلوبة',
    'support.threshold.explain.body': 'كم صوت متبقٍ للقبول — أو، لبند قائم، للحذف. كلما زاد تأييد النسخة الحالية، زادت العتبة.',
    'newclause.explain.heading': 'يغيب بند كامل؟',
    'newclause.explain.body': 'اقترحوا بنداً جديداً — الزر يظهر بين البنود. على الحاسوب: مرروا المؤشر بين بندين. على الجوال: اضغطوا بين بندين.',
    'consensus.meter.explain.heading': 'مقياس التوافق',
    'consensus.meter.explain.body': 'يُظهر مستوى التوافق. كلما ارتفع — ارتفعت العتبة لقبول اقتراح. اضغطوا للتفاصيل.',
    'versions.counter.explain.heading': 'تاريخ الإصدارات',
    'versions.counter.explain.body': 'كل مقترح مقبول أنشأ إصداراً. الرقم يمثل عدد الإصدارات المعتمدة. اضغطوا لرؤية التاريخ.',
    'versions.browse.explain.heading': 'كيف تطورت الوثيقة',
    'versions.browse.explain.body': 'كل نقرة على "إصدار أقدم" تُظهر الوثيقة في مرحلة سابقة. كل إصدار يمثل توافقاً وصل إليه المجتمع — ويتسع الدعم من إصدار لآخر.',
    'versions.change.explain.heading': 'ماذا تغيّر؟',
    'versions.change.explain.body': 'أخضر = مُضاف، أحمر = محذوف. انقروا على البند المُميَّز لعرض النقاش الذي أدى إلى التغيير.',
    'sidebar.explain.heading': 'الاقتراح الذي أدى للتغيير',
    'sidebar.explain.body': 'هنا النقاش الكامل — ماذا اقترحوا، كم صوّتوا، وما الحجج. كل تغيير مرّ بنقاش وتصويت مجتمعي.',
    'points.ranking.explain.heading': 'نقاطك تعكس إسهامك',
    'points.ranking.explain.body': 'النقاط تصفي الضوضاء — تقديم فكرة ينفق نقاطاً. لكن عندما يدعم المجتمع اقتراحك، تسترجع أكثر بكثير. كلما زاد تأثير إسهاماتك — تنمو نقاطك.',
    'points.ranking.explain.learnMore': 'كيف تكسب النقاط؟',
    'tour.summary.heading': 'ملخص الجولة',
    'tour.summary.body': 'استعرضتم كل الأدوات: تقسيم الوثيقة، اقتراح التعديلات، التصويت، مقياس التوافق، وتوثيق الإصدارات. أنتم مستعدون للمشاركة.',
    'welcome.overlay.heading': 'مرحباً بكم في جولة المنصة',
    'welcome.overlay.body': 'جولة قصيرة حول استخدام المنصة: قراءة الوثائق، اقتراح التغييرات، التصويت، ومتابعة التاريخ. لنبدأ من الصفحة الرئيسية.',
    'welcome.overlay.cta': 'لنبدأ',
    'welcome.intro.prepare.heading': 'مرحباً بكم في الجولة',
    'welcome.intro.prepare.body': 'في المجموعة يمكنكم النقاش والمشاركة في الكتابة المشتركة، ورؤية كيف يبني المجتمع الوثائق معاً. لنبدأ بفهم ما هي المجموعة.',
    'nav.restart': 'جولة في المنصة',
    'signup.prompt.heading': 'للمتابعة يجب التسجيل',
    'signup.prompt.body': 'التسجيل مجاني ويستغرق ثوانٍ. بعده ستعودون إلى هنا مباشرة.',
    'signup.prompt.cta': 'تسجيل',
  },
  en: {
    'home.intro.success': 'Great, let\'s go',
    'group.intro.success': 'Great, let\'s go',
    'home.groups.heading': 'A group is a collaboration space',
    'home.groups.body': 'Members write documents together and vote on every suggestion. Click a group to start participating.',
    'group.explain.heading': 'Welcome to the group',
    'group.explain.body': 'A group is a collaboration space — where documents are written together, changes proposed, and decisions made by voting.',
    'group.docs.heading': 'Group documents',
    'group.docs.body': 'Click a document to continue the tour.',
    'doc.title.heading': 'Understand the context',
    'doc.title.body': 'The document\'s name and purpose. Reading the background gives the full picture before proposing changes.',
    'doc.counters.heading': 'The document\'s pulse',
    'doc.counters.body': 'Active partners, discussions, agreement level, and approved versions. Click any number for details.',
    'editclause.explain.heading': 'Every section is open to change',
    'editclause.explain.body': 'Don\'t agree with existing wording? Every section is open to edit or delete proposals. The community votes, and if it gains support — the document updates automatically.',
    'editclause.buttons.heading': 'How to propose a change?',
    'editclause.buttons.body': 'On desktop: hover over the section. On mobile: tap it. The edit and delete buttons appear right away.',
    'browse.explain.heading': 'Multiple proposals per section',
    'browse.explain.body': 'Proposals submitted for this section? Browsing arrows let you flip through and compare them. This is how you find the best version.',
    'vote.explain.heading': 'Your vote decides',
    'vote.explain.body': 'Vote "for" to bring a proposal closer to approval, or "against" to push it back. You can also vote against an existing section to promote its deletion. Every vote impacts the final wording.',
    'support.threshold.explain.heading': 'Support threshold required',
    'support.threshold.explain.body': 'How many votes are still needed — for a new proposal, "for" votes to approval; for an existing section, "against" votes to deletion. The higher the support for the current version, the higher the threshold.',
    'newclause.explain.heading': 'Missing a whole section?',
    'newclause.explain.body': 'A new idea not in the document? Add a new section. On desktop: hover in the gap between two sections. On mobile: tap the gap. An "Add section" button appears.',
    'consensus.meter.explain.heading': 'Consensus meter',
    'consensus.meter.explain.body': 'Shows the agreement level. The higher it is — the higher the bar for acceptance. Click for details.',
    'versions.counter.explain.heading': 'Version history',
    'versions.counter.explain.body': 'Every accepted proposal created a new version. This number shows how many versions were approved. Click to see the history.',
    'versions.browse.explain.heading': 'How the document evolved',
    'versions.browse.explain.body': 'Each click on "Older version" shows the document at a previous stage. Every version represents a consensus reached — support grows from version to version.',
    'versions.change.explain.heading': 'What changed?',
    'versions.change.explain.body': 'Green = words added, red = words deleted. Click the highlighted section to open the discussion.',
    'sidebar.explain.heading': 'The proposal behind the change',
    'sidebar.explain.body': 'Here\'s the full discussion — what was proposed, how many voted, and the arguments. Every change went through community discussion and voting.',
    'points.ranking.explain.heading': 'Points reflect contribution',
    'points.ranking.explain.body': 'Points filter noise — submitting a proposal costs points. But when the community supports your proposal, you get back far more. The more influential your contributions — the more your points grow.',
    'points.ranking.explain.learnMore': 'How to Earn Points?',
    'tour.summary.heading': 'Excellent! You\'re ready to make an impact',
    'tour.summary.body': 'You\'ve covered all the tools: reading sections, comparing proposals, voting, and tracking version history. The power to shape this document is in your hands.',
    'welcome.overlay.heading': 'Welcome to the Platform Tour',
    'welcome.overlay.body': 'A short tour on using the platform: reading documents, proposing changes, voting, and tracking history. Let\'s start from the home page.',
    'welcome.overlay.cta': "Let's start",
    'welcome.intro.prepare.heading': 'Welcome to the Tour',
    'welcome.intro.prepare.body': 'In a group you can discuss, write collaboratively, and see how the community builds documents together. Let\'s start by understanding what a group is.',
    'nav.restart': 'Platform tour',
    'signup.prompt.heading': "You'll need an account to continue",
    'signup.prompt.body': 'Signing up is free and takes seconds. Afterward you\'ll be brought right back here.',
    'signup.prompt.cta': 'Sign up',
  },
};

/**
 * Resolve an i18n key to the translated string.
 * Falls back to Hebrew, then the key itself.
 */
export function tTutorial(key, language = 'he') {
  if (!key) return '';
  const lang = tutorialStrings[language] || tutorialStrings.he;
  return lang[key] || tutorialStrings.he[key] || key;
}

/**
 * Prepare for group explanation - introduce groups to the user
 */
export const WELCOME_INTRO_PREPARE_STEP = {
  id: 'welcome-intro-prepare',
  type: 'explain',
  targetSelector: '.group-header',
  tooltipPosition: 'fixed-top-left',
  heading: 'welcome.intro.prepare.heading',
  body: 'welcome.intro.prepare.body',
};

/**
 * Mid-tutorial steps shown on the group page.
 * Step 1: Explain what a group is.
 * Step 2: Guide user to click a document.
 */
export const GROUP_EXPLAIN_STEP = {
  id: 'group-explain',
  type: 'explain',
  targetSelector: '.group-header',
  tooltipPosition: 'fixed-top-left',
  heading: 'group.explain.heading',
  body: 'group.explain.body',
};

export const GROUP_INTRO_STEP = {
   id: 'group-intro',
   type: 'practice',
   targetSelector: '.group-documents-card',
   tooltipPosition: 'left',
   heading: 'group.docs.heading',
   body: 'group.docs.body',
   successMessage: 'group.intro.success',
   completionEvent: 'document:entered',
 };

/**
 * Pre-tutorial step shown on the home page.
 * No progress dots, no scrim — spotlight only on .groups-list.
 */
export const HOME_INTRO_STEP = {
   id: 'home-intro',
   type: 'practice',
   targetSelector: '.groups-list',
   tooltipPosition: 'bottom',
   heading: 'home.groups.heading',
   body: 'home.groups.body',
   successMessage: 'home.intro.success',
   completionEvent: 'document:entered',
 };

/** @type {Array} */
export const TUTORIAL_STEPS = [
  // -1. Welcome intro prep — shown before group-explain step on group page
  WELCOME_INTRO_PREPARE_STEP,

  // 0. Foundation: Document title & description
  {
    id: 'doc-title-explain',
    type: 'explain',
    targetSelector: '.document-title-section',
    tooltipPosition: 'bottom',
    heading: 'doc.title.heading',
    body: 'doc.title.body',
  },

  // 2. Community stats
  {
    id: 'doc-counters-explain',
    type: 'explain',
    targetSelector: '.document-counters',
    tooltipPosition: 'bottom',
    heading: 'doc.counters.heading',
    body: 'doc.counters.body',
  },

  // 3. Proposal editing - explain concept
  {
    id: 'editproposal-explain',
    type: 'explain',
    targetSelector: '.section-card',
    tooltipPosition: 'bottom',
    heading: 'editclause.explain.heading',
    body: 'editclause.explain.body',
  },

  // 3.5. Edit buttons explanation — spotlight on the actual action buttons
  {
    id: 'editclause-buttons',
    type: 'explain',
    targetSelector: '.section-action-buttons',
    tooltipPosition: 'bottom',
    heading: 'editclause.buttons.heading',
    body: 'editclause.buttons.body',
    forceRevealTarget: true,
  },

  // 5. Browsing proposals (viewing versions)
  {
   id: 'browse-explain',
   type: 'explain',
   targetSelector: '.section-card',
   tooltipPosition: 'bottom',
   heading: 'browse.explain.heading',
   body: 'browse.explain.body',
   actionOnNext: 'expandProposal',
  },

  // 7. Voting (core mechanic)
  {
    id: 'vote-explain',
    type: 'explain',
    targetSelector: '.proposal-vote-buttons',
    tooltipPosition: 'top',
    heading: 'vote.explain.heading',
    body: 'vote.explain.body',
  },

  // 8. Support threshold - explain the support bar above voting buttons
  {
    id: 'support-threshold-explain',
    type: 'explain',
    targetSelector: '[data-tutorial="support-threshold"]',
    tooltipPosition: 'bottom',
    heading: 'support.threshold.explain.heading',
    body: 'support.threshold.explain.body',
    forceRevealTarget: true,
  },

  // 13. New section - explain concept
  {
    id: 'newclause-explain',
    type: 'explain',
    targetSelector: '.section-insert-space',
    tooltipPosition: 'bottom',
    heading: 'newclause.explain.heading',
    body: 'newclause.explain.body',
    forceRevealTarget: true,
  },

  // 14. Consensus meter - learn about support threshold
  {
    id: 'consensus-meter-explain',
    type: 'explain',
    targetSelector: '.consensus-meter',
    tooltipPosition: 'bottom',
    heading: 'consensus.meter.explain.heading',
    body: 'consensus.meter.explain.body',
  },

  // 15. Versions counter - learn about document history and navigate to clean view
  {
    id: 'versions-counter-explain',
    type: 'explain',
    targetSelector: '.versions-tab-button',
    tooltipPosition: 'bottom',
    heading: 'versions.counter.explain.heading',
    body: 'versions.counter.explain.body',
    navigateOnNext: 'DocumentCleanView',
  },

  // 16. Browse versions — explain the older-version button on DocumentCleanView
  {
    id: 'versions-browse-explain',
    type: 'explain',
    targetSelector: '.versions-older-btn',
    tooltipPosition: 'top',
    heading: 'versions.browse.explain.heading',
    body: 'versions.browse.explain.body',
    actionOnNext: 'navigateOlderVersion',
  },

  // 17. Explain the highlighted change in the navigated version
  {
    id: 'versions-change-explain',
    type: 'explain',
    targetSelector: '[id^="change-"]',
    tooltipPosition: 'bottom',
    heading: 'versions.change.explain.heading',
    body: 'versions.change.explain.body',
    navigateOnNext: 'DocumentView',
    additionalSpotlights: ['.version-nav-buttons'],
  },

  // 18. Points ranking explanation — before tour summary
  {
   id: 'points-ranking-explain',
   type: 'explain',
   targetSelector: '.user-points-badge',
   tooltipPosition: 'bottom',
   heading: 'points.ranking.explain.heading',
   body: 'points.ranking.explain.body',
  },

  // 19. Tour summary — back on DocumentView
  {
   id: 'tour-summary',
   type: 'explain',
   targetSelector: '.document-title-section',
   tooltipPosition: 'bottom',
   heading: 'tour.summary.heading',
   body: 'tour.summary.body',
  },

];