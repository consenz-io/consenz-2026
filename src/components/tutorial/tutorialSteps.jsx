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
    'home.groups.body': 'חברי הקבוצה כותבים מסמכים ביחד, מציעים שינויים, ומצביעים על כל הצעה. לחצו על קבוצה כדי לראות את המסמכים שלה ולהתחיל להשתתף.',
    'group.explain.heading': 'ברוכים הבאים לקבוצה',
    'group.explain.body': 'קבוצה היא מרחב שיתוף פעולה — כאן מתנהלים דיונים, מוצעות שינויים ומתקבלות החלטות יחד. כל קבוצה מכילה מסמכים משותפים שהחברים בה כותבים ומעצבים ביחד.',
    'group.docs.heading': 'מסמכי הקבוצה',
    'group.docs.body': 'אלה המסמכים המשותפים של הקבוצה. לחצו על אחד מהם כדי להמשיך בהדרכה.',
    'doc.title.heading': 'להבין את ההקשר',
    'doc.title.body': 'כאן מופיעים שם המסמך ומטרת העל שלו. קריאת הרקע תעזור לכם לקבל תמונה מלאה לפני שצוללים לסעיפים הספציפיים ומציעים שינויים.',
    'doc.counters.heading': 'הדופק של המסמך',
    'doc.counters.body': 'המספרים האלו מראים לכם כמה שותפים פעילים במסמך כרגע, כמה דיונים מתקיימים, מהי רמת ההסכמה הכללית וכמה גרסאות כבר אושרו. לחצו על כל נתון כדי לראות מידע נוסף.',
    'editclause.explain.heading': 'התוכן גמיש – ופתוח לשינוי שלכם',
    'editclause.explain.body': 'המסמך מחולק לנושאים וסעיפים. לא מסכימים עם נוסח קיים? כל סעיף פתוח להצעות עריכה או מחיקה. הקהילה תצביע על ההצעה שלכם, ואם תזכו לתמיכה – המסמך יתעדכן אוטומטית!',
    'editclause.buttons.heading': 'איך מציעים שינוי?',
    'editclause.buttons.body': 'במחשב: העבירו את העכבר מעל הסעיף. בנייד: לחצו לחיצה קלה על הסעיף. כפתורי העריכה והמחיקה יופיעו מיד ויאפשרו לכם להציע נוסח משלכם.',
    'browse.explain.heading': 'דפדוף בין הצעות עריכה לסעיף',
    'browse.explain.body': 'אם פורסמו הצעות לשינוי הסעיף — יופיעו כאן חצי דפדוף שיאפשרו לכם לעבור ביניהן ולהשוות את הרעיונות השונים. כך תוכלו לראות מה הקהילה מציעה ולבחור את ההצעה שנראית לכם הטובה ביותר.',
    'vote.explain.heading': 'הקול שלכם קובע ומכריע',
    'vote.explain.body': 'מצאתם הצעה מוצלחת? הצביעו בעד כדי לקרב אותה לאישור. חושבים שהיא מזיקה? הצביעו נגד וכך תצמצמו את סיכוייה להיכנס למסמך. באותו אופן, אפשר להצביע נגד סעיף קיים כדי לקדם את מחיקתו מהמסמך. כל קול משפיע ישירות על הניסוח הסופי של המסמך.',
    'support.threshold.explain.heading': 'רף התומכים הדרוש',
    'support.threshold.explain.body': 'הבר הזה מציג כמה הצבעות חסרות לאישור הצעה — או, בסעיף קיים, כמה הצבעות נגד חסרות למחיקתו. ככל שהתמיכה שקיבלה הגרסה העדכנית של המסמך גבוהה יותר, כך מספר התומכים הדרוש לאישור הצעה יהיה גבוה יותר.',
    'newclause.explain.heading': 'מרגישים שחסר נושא או סעיף שלם?',
    'newclause.explain.body': 'אם יש רעיון חדש לגמרי שלא מופיע במסמך, תוכלו להוסיף הצעה לסעיף חדש. כדי לראות את הכפתור להוספת סעיף - במחשב: העמידו את סמן העכבר במרווח שבין שני סעיפים. בנייד: לחצו על הרווח שבין הסעיפים. כפתור \'הוספת סעיף\' יופיע מיד.',
    'consensus.meter.explain.heading': 'מד הקונסנזוס',
    'consensus.meter.explain.body': 'המד מציג את רמת ההסכמה במסמך. ככל שהיא גבוהה יותר — כך גבוה יותר הרף להצעה להתקבל. לחצו כדי ללמוד איך זה מחושב.',
    'versions.counter.explain.heading': 'מסמך חי: היסטוריית הגרסאות',
    'versions.counter.explain.body': 'כל הצעה שהתקבלה יצרה גרסה חדשה ורשמית של המסמך. הספרה הזו מייצגת את כמות הגרסאות שהקהילה אישרה עד היום. בואו נלחץ עליה כדי לראות את היסטוריית השינויים.',
    'versions.browse.explain.heading': 'לראות איך המסמך התפתח',
    'versions.browse.explain.body': 'כל לחיצה על "גרסה קודמת" תראה לכם את המסמך בשלב קודם. כל גרסה מייצגת הסכמה שהקהילה הגיעה אליה — מגרסה לגרסה, התמיכה במסמך גדלה ומתרחבת בזכות ההצעות וההצבעות של הקהילה. זה תיעוד מלא של איך המסמך בנוי ביחד.',
    'versions.change.explain.heading': 'רואים בדיוק מה השתנה',
    'versions.change.explain.body': 'שינויים מוצגים בצורה ברורה: רקע ירוק מסמן מילים שנוספו, ורקע אדום מסמן מילים שנמחקו. כך אתם תמיד יודעים מה בדיוק השתנה בכל גרסה.',
    'sidebar.explain.heading': 'פרטי ההצעה שהובילה לשינוי',
    'sidebar.explain.body': 'כאן תוכלו לראות את הדיון המלא — מה הציעו, כמה הצביעו, ומה הטיעונים שנאמרו. כל שינוי במסמך עבר תהליך כזה של דיון והצבעה קהילתית.',
    'points.ranking.explain.heading': 'הניקוד שלך משקף את התרומה שלך',
    'points.ranking.explain.body': 'הניקוד משמש שני תפקידים: ראשית, הוא מסנן רעש — כשמציעים רעיון, זה עולה נקודות. שנית, הוא משקף השפעה — כשהקהילה תומכת בהצעה שלך, אתה מחזיר הרבה יותר. ככל שהתרומות שלך משפיעות יותר, הניקוד גדל.',
    'points.ranking.explain.learnMore': 'איך צוברים נקודות?',
    'tour.summary.heading': 'מצוין! אתם מוכנים להשפיע',
    'tour.summary.body': 'עברתם על כל הכלים של Consenz: קריאת סעיפים, השוואה בין הצעות שונות, הצבעה משפיעה, ומעקב אחר היסטוריית הגרסאות של הקהילה. עכשיו הכוח לעצב את המסמך נמצא בידיים שלכם.',
    'welcome.overlay.heading': 'ברוכים הבאים לסיור בפלטפורמה',
    'welcome.overlay.body': 'בסיור קצר זה תקבלו הסבר צעד אחר צעד על השימוש בפלטפורמה: כיצד לקרוא מסמכים, להציע שינויים, להצביע, ולעקוב אחר ההיסטוריה של המסמך. בואו נתחיל מעמוד הבית.',
    'welcome.overlay.cta': 'בואו נתחיל',
    'welcome.intro.prepare.heading': 'ברוכים הבאים לסיור',
    'welcome.intro.prepare.body': 'בקבוצה תוכלו לדיון, להשתתף בכתיבה משותפת, ולצפות כיצד הקהילה בונה מסמכים ביחד. בואו נתחיל בהבנת מה זו קבוצה.',
    'nav.restart': 'סיור בפלטפורמה',
    'signup.prompt.heading': 'כדי להמשיך צריך להירשם',
    'signup.prompt.body': 'ההרשמה חינמית ולוקחת שניות. אחרי ההרשמה תחזרו בדיוק לכאן.',
    'signup.prompt.cta': 'הרשמה',
  },
  ar: {
    'home.intro.success': 'رائع، لنبدأ',
    'group.intro.success': 'رائع، لنبدأ',
    'home.groups.heading': 'المجموعة هي فضاء للتعاون',
    'home.groups.body': 'يكتب أعضاء المجموعة وثائق معاً، يقترحون تعديلات، ويصوتون على كل اقتراح. اضغطوا على مجموعة لرؤية وثائقها والمشاركة.',
    'group.explain.heading': 'مرحباً بكم في المجموعة',
    'group.explain.body': 'المجموعة هي فضاء للتعاون — هنا تجري النقاشات، تُقترح التعديلات وتُتخذ القرارات معاً. تحتوي كل مجموعة على وثائق مشتركة يكتبها الأعضاء ويشكّلونها سوياً.',
    'group.docs.heading': 'وثائق المجموعة',
    'group.docs.body': 'هذه هي الوثائق المشتركة للمجموعة. اضغطوا على إحداها للدخول والمشاركة.',
    'doc.title.heading': 'عنوان الوثيقة ووصفها',
    'doc.title.body': 'هنا يظهر اسم الوثيقة وخلفيتها — ما الذي تتناوله وما هدفها. اقرأوهما قبل التعمق في البنود.',
    'doc.counters.heading': 'بيانات الوثيقة في لمحة سريعة',
    'doc.counters.body': 'تُظهر هذه الأرقام عدد المشاركين النشطين في الوثيقة، وعدد التعليقات المسجلة، ومستوى التوافق — وعدد الإصدارات المقبولة. يمكنكم الضغط على كل رقم للحصول على مزيد من المعلومات: قائمة المشاركين، شرح مقياس التوافق، وعرض إصدارات الوثيقة.',
    'editclause.explain.heading': 'بنود الوثيقة — وكيفية تعديلها',
    'editclause.explain.body': 'الوثيقة مقسمة إلى مواضيع وبنود، وكل بند هو محتوى أُنشئ بشكل تعاوني. لا توافقون على صياغة موجودة؟ يمكنكم اقتراح إعادة صياغة أي بند — أو اقتراح حذفه كلياً. هذه التغييرات أيضاً تخضع للتصويت، وإذا وافق المجتمع — ستُدرج في الوثيقة.',
    'editclause.buttons.heading': 'أزرار اقتراح التعديل والحذف',
    'editclause.buttons.body': 'هذه هي الأزرار لاقتراح تعديل البند أو حذفه — تظهر عند تمرير مؤشر الماوس فوق البند، أو عند الضغط على البند في شاشات اللمس.',
    'browse.explain.heading': 'لكل بند عدة نسخ',
    'browse.explain.body': 'إذا نُشرت اقتراحات لتعديل البند — ستظهر هنا أسهم للتنقل بينها ومقارنة الأفكار المختلفة. بهذه الطريقة يمكنكم رؤية ما يقترحه المجتمع واختيار الصياغة الأفضل.',
    'vote.explain.heading': 'تصويتكم يشكّل الوثيقة',
    'vote.explain.body': 'كل صوت مهم. التصويت لصالح مقترح يقرّبه من القبول. التصويت ضده يقلّل من فرصه في دخول الوثيقة. وبالمثل، يمكنكم التصويت ضد بند قائم لتعزيز حذفه من الوثيقة. كل صوت يؤثر مباشرة على الصيغة النهائية للمستند.',
    'support.threshold.explain.heading': 'عتبة التأييد المطلوبة',
    'support.threshold.explain.body': 'يُظهر هذا الشريط عدد الأصوات المتبقية المطلوبة — لاقتراح جديد، كم صوت "مع" للقبول؛ ولقسم قائم، كم صوت "ضد" للحذف. كلما زاد التأييد الذي تلقته النسخة الحالية من الوثيقة، زاد عدد المؤيدين المطلوبين لقبول اقتراح التعديل.',
    'newclause.explain.heading': 'هل يغيب شيء عن الوثيقة؟',
    'newclause.explain.body': 'يمكنكم اقتراح بند جديد كلياً — الزر يظهر بين البنود. على الحاسوب: مرروا مؤشر الفأرة بين بندين. على الجوال: اضغطوا على الشاشة بين بندين.',
    'consensus.meter.explain.heading': 'مقياس التوافق',
    'consensus.meter.explain.body': 'يُظهر هذا المقياس مستوى التوافق في الوثيقة. كلما ارتفع — ارتفع الرف لقبول اقتراح. اضغطوا لفهم كيفية حسابه.',
    'versions.counter.explain.heading': 'عداد الإصدارات يُظهر التاريخ',
    'versions.counter.explain.body': 'هذا الرقم يُظهر كم إصدار موجود من الوثيقة. كل إصدار هو جزء من تاريخ الوثيقة — حالة وافق عليها المجتمع. اضغطوا لرؤية جميع الإصدارات والتغييرات التي حدثت.',
    'versions.browse.explain.heading': 'شاهدوا كيف تطورت الوثيقة',
    'versions.browse.explain.body': 'كل نقرة على "إصدار أقدم" ستُظهر لكم الوثيقة في مرحلة سابقة. كل إصدار يمثل توافقاً وصلت إليه المجتمع — من إصدار لآخر، يتسع الدعم للوثيقة من خلال اقتراحات وتصويتات المجتمع. هذا سجل كامل لكيفية بناء الوثيقة معاً.',
    'versions.change.explain.heading': 'هكذا يبدو التغيير في الإصدار',
    'versions.change.explain.body': 'الأخضر = محتوى مُضاف، الأحمر = محتوى محذوف. عندما يتعلق الأمر باقتراح تعديل تم قبوله، يمكنكم رؤية بالضبط أي الكلمات تغيّرت داخل البند. انقروا على البند المُميَّز لعرض النقاش الذي أدى إلى هذا التغيير.',
    'sidebar.explain.heading': 'تفاصيل الاقتراح الذي أدى إلى التغيير',
    'sidebar.explain.body': 'هنا يمكنكم رؤية النقاش الكامل — ماذا اقترحوا، كم صوّتوا، وما الحجج التي قيلت. كل تغيير في الوثيقة مرّ بهذه العملية من النقاش والتصويت المجتمعي.',
    'points.ranking.explain.heading': 'نقاطك تعكس إسهامك',
    'points.ranking.explain.body': 'النقاط لها وظيفتان: أولاً، تصفي الضوضاء — تقديم فكرة ينفق نقاطاً. ثانياً، تعكس التأثير — عندما يدعم المجتمع اقتراحك، تسترجع أكثر بكثير. كلما كانت إسهاماتك أكثر تأثيراً، تنمو نقاطك.',
    'points.ranking.explain.learnMore': 'كيف تكسب النقاط؟',
    'tour.summary.heading': 'ملخص الجولة',
    'tour.summary.body': 'لقد استعرضتم جميع مكوّنات Consenz: رأيتم كيف تُقسَّم الوثيقة إلى مواضيع وبنود، وكيف يُقترح التعديلات ويُصوَّت عليها، وكيف يحدد مقياس التوافق متى يُقبل اقتراح، وكيف يُوثَّق كل إصدار في التاريخ. أنتم الآن مستعدون للمشاركة.',
    'welcome.overlay.heading': 'مرحباً بكم في جولة المنصة',
    'welcome.overlay.body': 'في هذه الجولة القصيرة ستحصلون على شرح خطوة بخطوة حول استخدام المنصة: كيفية قراءة الوثائق، اقتراح التغييرات، التصويت، ومتابعة تاريخ الوثيقة. لنبدأ من الصفحة الرئيسية.',
    'welcome.overlay.cta': 'لنبدأ',
    'welcome.intro.prepare.heading': 'مرحباً بكم في الجولة',
    'welcome.intro.prepare.body': 'في المجموعة ستتمكنون من النقاش والمشاركة في الكتابة المشتركة، ورؤية كيفية بناء المجتمع للوثائق معاً. لنبدأ بفهم ما هي المجموعة.',
    'nav.restart': 'جولة في المنصة',
    'signup.prompt.heading': 'للمتابعة يجب التسجيل',
    'signup.prompt.body': 'التسجيل مجاني ويستغرق ثوانٍ. بعد التسجيل ستعودون إلى هنا مباشرة.',
    'signup.prompt.cta': 'تسجيل',
  },
  en: {
    'home.intro.success': 'Great, let\'s go',
    'group.intro.success': 'Great, let\'s go',
    'home.groups.heading': 'A group is a collaboration space',
    'home.groups.body': 'Group members write documents together, propose changes, and vote on every suggestion. Click a group to see its documents and start participating.',
    'group.explain.heading': 'Welcome to the group',
    'group.explain.body': 'A group is a collaboration space — this is where discussions happen, changes are proposed, and decisions are made together. Each group contains shared documents that members write and shape collectively.',
    'group.docs.heading': 'Group documents',
    'group.docs.body': "These are the group's shared documents. Click one to enter and start participating.",
    'doc.title.heading': 'Understand the context',
    'doc.title.body': 'Here you\'ll see the document\'s name and purpose. Reading the background will help you get the full picture before diving into specific sections and proposing changes.',
    'doc.counters.heading': 'The document\'s pulse',
    'doc.counters.body': 'These numbers show you how many active partners are in the document right now, how many discussions are happening, what the overall agreement level is, and how many versions have already been approved. Click any number to see more details.',
    'editclause.explain.heading': 'Content is flexible — and open to your changes',
    'editclause.explain.body': 'The document is divided into topics and sections. Don\'t agree with existing wording? Every section is open to edit or delete proposals. The community will vote on your proposal, and if it gains support — the document updates automatically!',
    'editclause.buttons.heading': 'How to propose a change?',
    'editclause.buttons.body': 'On desktop: hover your mouse over the section. On mobile: tap the section lightly. The edit and delete buttons will appear right away and let you propose your own wording.',
    'browse.explain.heading': 'There\'s more than one way to phrase a section',
    'browse.explain.body': 'If edit proposals have been submitted for this section, browsing arrows will appear here — letting you flip through the community\'s ideas and compare them. This is how you find the best version together.',
    'vote.explain.heading': 'Your voice decides and makes a difference',
    'vote.explain.body': 'Found a great proposal? Vote for it to bring it closer to approval. Think it\'s harmful? Vote against it and reduce its chances of entering the document. Similarly, you can vote against an existing section to promote its deletion from the document. Every vote directly impacts the final wording of the document.',
    'support.threshold.explain.heading': 'Support threshold required',
    'support.threshold.explain.body': 'This bar shows how many votes are still needed — for a new proposal, how many "for" votes to approval; for an existing section, how many "against" votes to deletion. The higher the support the current version of the document has received, the higher the number of supporters needed to approve an edit proposal.',
    'newclause.explain.heading': 'Feel like a whole topic or section is missing?',
    'newclause.explain.body': 'If there\'s a completely new idea that doesn\'t appear in the document, you can add it! On desktop: hover your mouse in the gap between two sections. On mobile: tap the gap between sections. An "Add section" button will appear right away.',
    'consensus.meter.explain.heading': 'Consensus meter',
    'consensus.meter.explain.body': 'This meter shows the agreement level in the document. The higher it is — the higher the bar for a proposal to be accepted. Click to learn how it\'s calculated.',
    'versions.counter.explain.heading': 'Living document: version history',
    'versions.counter.explain.body': 'Every accepted proposal created a new official version of the document. This number represents how many versions the community has approved to date. Let\'s click it to see the history of changes.',
    'versions.browse.explain.heading': 'See how the document evolved',
    'versions.browse.explain.body': 'Each click on "Older version" shows you the document at a previous stage. Every version represents a consensus the community reached — from version to version, support for the document grows and expands through the community\'s proposals and votes. This is a complete record of how the document is built together.',
    'versions.change.explain.heading': 'See exactly what changed',
    'versions.change.explain.body': 'Changes are displayed clearly: a green background marks words that were added, and a red background marks words that were deleted. This way you always know exactly what changed in each version.',
    'sidebar.explain.heading': 'Details of the proposal that led to this change',
    'sidebar.explain.body': 'Here you can see the full discussion — what was proposed, how many voted, and what arguments were made. Every change in the document went through this process of community discussion and voting.',
    'points.ranking.explain.heading': 'Your points reflect your contribution',
    'points.ranking.explain.body': 'Points serve two purposes: first, they filter noise — submitting a proposal costs points. Second, they reflect impact — when the community supports your proposal, you get back far more. The more influential your contributions, the more your points grow.',
    'points.ranking.explain.learnMore': 'How to Earn Points?',
    'tour.summary.heading': 'Excellent! You\'re ready to make an impact',
    'tour.summary.body': 'You\'ve covered all the tools of Consenz: reading sections, comparing different proposals, voting with real impact, and tracking the community\'s version history. Now the power to shape this document is in your hands.',
    'welcome.overlay.heading': 'Welcome to the Platform Tour',
    'welcome.overlay.body': "In this short tour you'll get a step-by-step explanation of how to use the platform: how to read documents, propose changes, vote, and track the document's history. Let's start from the home page.",
    'welcome.overlay.cta': "Let's start",
    'welcome.intro.prepare.heading': 'Welcome to the Tour',
    'welcome.intro.prepare.body': 'In a group you can discuss, participate in collaborative writing, and see how the community builds documents together. Let\'s start by understanding what a group is.',
    'nav.restart': 'Platform tour',
    'signup.prompt.heading': "You'll need an account to continue",
    'signup.prompt.body': "Signing up is free and takes seconds. After registering you'll be brought right back here.",
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