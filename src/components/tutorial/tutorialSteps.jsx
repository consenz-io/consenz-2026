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
    'home.groups.heading': 'הכל מתחיל מקבוצה',
    'home.groups.body': 'כל קבוצה מנהלת מסמכים משותפים. לחצו על קבוצה כדי לראות את המסמכים שלה — ומשם תוכלו להיכנס לאחד מהם.',
    'group.explain.heading': 'ברוכים הבאים לקבוצה',
    'group.explain.body': 'קבוצה היא מרחב שיתוף פעולה — כאן מתנהלים דיונים, מוצעות שינויים ומתקבלות החלטות יחד. כל קבוצה מכילה מסמכים משותפים שהחברים בה כותבים ומעצבים ביחד.',
    'group.docs.heading': 'בחרו מסמך כדי להמשיך',
    'group.docs.body': 'אלה המסמכים המשותפים של הקבוצה. לחצו על אחד מהם כדי להיכנס ולהתחיל להשתתף.',
    'doc.title.heading': 'כותרת המסמך ותיאורו',
    'doc.title.body': 'כאן מופיעים שם המסמך והרקע שלו — מה הוא עוסק בו ומה מטרתו. קראו אותו לפני שצוללים לסעיפים.',
    'doc.counters.heading': 'נתוני הקהילה במבט מהיר',
    'doc.counters.body': 'הספרות האלה מראות כמה משתתפים פועלים במסמך, כמה תגובות נרשמו, מה רמת הקונצנזוס — וכמה גרסאות כבר התקבלו.',
    'doc.sections.heading': 'סעיפי המסמך',
    'doc.sections.body': 'המסמך מחולק לנושאים וסעיפים. כל סעיף מכיל תוכן שנוצר בשיתוף פעולה, ואפשר להציע לו שינויים.',
    'doc.title.counter.heading': 'קראו את הכותרת והתיאור של המסמך',
    'doc.title.counter.body': 'הכותרת מספרת לכם על מה המסמך. התיאור מוסבר את ההקשר ומה מטרת המסמך. זה עוזר להבין מה הקהילה בונה ביחד.',
    'browse.explain.heading': 'לכל סעיף יש כמה גרסאות',
    'browse.explain.body': 'חברי הקהילה מציעים שינויים לכל סעיף. החצים מאפשרים לעבור ביניהם ולראות מה כל אחד מציע.',
    'browse.encourage.heading': 'בואו נדפדף בין הגרסאות',
    'browse.encourage.body': 'כדי לראות אילו שינויים המשתתפים בדיון הציעו לעריכת הסעיף.',
    'comment.counter.encourage.heading': 'ראו את התגובות הקיימות',
    'comment.counter.encourage.body': 'לחצו על מספר התגובות כדי לראות מה אחרים אומרים. זו דרך טובה להבין את ההצעה עמוקות יותר.',
    'section.hover.encourage.heading': 'ריחוף על סעיף כדי להציע שינוי',
    'section.hover.encourage.body': 'כשתעמיד/י את העכבר על סעיף, יופיעו כפתורים שמאפשרים לך להציע עריכה או מחיקה.',
    'new.section.hover.encourage.heading': 'ריחוף בין סעיפים להוסיף סעיף חדש',
    'new.section.hover.encourage.body': 'כשתעמיד/י את העכבר בין שני סעיפים, יופיע כפתור להוספת סעיף חדש בתא הזה.',
    'browse.practice.heading': 'כדי לדפדף בין הצעות העריכה השונות',
    'browse.practice.success': 'טוב. ככה אפשר תמיד לראות מה הקהילה מציעה לכל חלק במסמך',
    'vote.explain.heading': 'ההצבעה שלכם מעצבת את המסמך',
    'vote.explain.body': 'כל קול קובע. הצבעה בעד מקרבת הצעה לאישור. הצבעה נגד מרחיקה אותה. ההצעה שתצבור מספיק תמיכה תיכנס למסמך.',
    'vote.practice.heading': 'הצביעו על הצעה שמצאתם מעניינת',
    'vote.practice.success': 'ההצבעה נרשמה ותשפיע על תוצאת ההצעה',
    'comment.explain.heading': 'יש מה להוסיף?',
    'comment.explain.body': 'תגובות עוזרות למציע להבין מה עובד ומה לא. זה המקום לשאול, להסביר, או לשכנע.',
    'comment.practice.heading': 'כתבו תגובה קצרה על אחת ההצעות',
    'comment.practice.success': 'התגובה פורסמה',
    'newclause.explain.heading': 'חסר משהו במסמך?',
    'newclause.explain.body': 'אם לדעתכם המסמך צריך נושא שעדיין לא מוזכר — אפשר להציע סעיף חדש לגמרי. אם הקהילה תסכים, הוא ייכנס למסמך.',
    'newclause.button.encourage.heading': 'הנה כפתור "הוסף סעיף"',
    'newclause.button.encourage.body': 'העמידו את סמן העכבר או לחצו על מסך המגע מתחת הסעיף שאחריו תרצו להוסיף סעיף חדש, ולחצו על הכפתור הזה.',
    'newclause.select.topic.heading': 'בחרו איזה נושא יקבל את הסעיף החדש',
    'newclause.select.topic.body': 'הסעיף החדש יתווסף לנושא שתבחרו. בחרו את הנושא המתאים ביותר מהרשימה.',
    'newclause.content.heading': 'הזינו את התוכן של הסעיף החדש',
    'newclause.content.body': 'כתבו את הטקסט של הסעיף החדש שאתם מציעים.',
    'newclause.content.success': 'טוב! עכשיו אפשר להוסיף הסבר.',
    'newclause.explanation.heading': 'הוסיפו הסבר (אופציונלי)',
    'newclause.explanation.body': 'הסביר למה אתם חושבים שהסעיף הזה חשוב. זה יעזור לקהילה להבין את ההצעה שלכם.',
    'newclause.submit.heading': 'שלחו את ההצעה',
    'newclause.submit.body': 'לחצו על כפתור "שלח" כדי לפרסם את הצעתכם. הקהילה תוכל להצביע עליה.',
    'newclause.submit.success': 'ההצעה פורסמה. הקהילה יכולה עכשיו להצביע עליה',
    'editclause.explain.heading': 'לא מסכימים עם ניסוח קיים?',
    'editclause.explain.body': 'אפשר להציע לנסח מחדש כל סעיף — או להציע למחוק אותו לגמרי. גם שינויים כאלה עוברים הצבעה, וגם הם יכולים לשנות את המסמך.',
    'editclause.practice.heading': 'בחרו סעיף קיים והציעו לו ניסוח אחר',
    'editclause.practice.success': 'הצעת השינוי פורסמה',
    'consensus.explain.heading': 'מתי הצעה מתקבלת?',
    'consensus.explain.body': 'לא מספיק רוב — צריך קונסנזוס. הצעה מתקבלת כשפער הקולות בעדה עובר את הרף. הרף מחושב מממוצע ההסכמה ההיסטורי של הקהילה: ככל שהחלטות קודמות התקבלו בהסכמה רחבה יותר — כך הרף לאישורים הבאים גבוה יותר. המסמך מחמיר עם עצמו ככל שהוא בשל יותר.',
    'versions.explain.heading': 'המסמך חי ומשתנה',
    'versions.explain.body': 'כל הצעה שהתקבלה יצרה גרסה חדשה. בעמוד הגרסאות אפשר לראות את ההיסטוריה המלאה — מה השתנה, מתי, ועל ידי מי.',
    'versions.navigate.heading': 'פתחו את עמוד הגרסאות',
    'versions.navigate.success': 'כאן מתועד כל שינוי שהקהילה אישרה',
    'versions.browse.heading': 'בחרו גרסה קודמת וראו מה השתנה',
    'versions.browse.success': 'ירוק = נוסף, אדום = הוסר. כך נראית דמוקרטיה בפעולה',
    'points.explain.heading': 'תרומה אמיתית מזכה בנקודות',
    'points.explain.body': 'הגשת הצעה עולה נקודות — זה מסנן רעש ומבטיח שכל הצעה רצינית. אבל אם ההצעה מקבלת תמיכה — מחזירים הרבה יותר ממה שהושקע.',
    'points.explain.cost.edit': 'הצעת עריכה לסעיף',
    'points.explain.cost.new': 'הצעת סעיף חדש',
    'points.explain.reward.upvote': 'כל הצבעת בעד על ההצעה',
    'points.explain.reward.aligned': 'הצבעה בכיוון הקהילה',
    'points.explain.reward.accepted': 'הצעה שהתקבלה',
    'closing.heading': 'מוכנים לתרום',
    'closing.body': 'עכשיו אתם יודעים איך Consenz עובדת. כל הצעה שתגישו, כל הצבעה שתתנו — מעצבת את המסמך הזה יחד עם שאר הקהילה.',
    'closing.cta': 'בואו נתחיל',
    'nav.restart': 'סיור בפלטפורמה',
    'signup.prompt.heading': 'כדי להמשיך צריך להירשם',
    'signup.prompt.body': 'ההרשמה חינמית ולוקחת שניות. אחרי ההרשמה תחזרו בדיוק לכאן.',
    'signup.prompt.cta': 'הרשמה',
  },
  ar: {
    'home.groups.heading': 'كل شيء يبدأ من مجموعة',
    'home.groups.body': 'كل مجموعة تدير وثائق مشتركة. اضغطوا على مجموعة لرؤية وثائقها — ومن هناك يمكنكم الدخول إلى إحداها.',
    'group.explain.heading': 'مرحباً بكم في المجموعة',
    'group.explain.body': 'المجموعة هي فضاء للتعاون — هنا تجري النقاشات، تُقترح التعديلات وتُتخذ القرارات معاً. تحتوي كل مجموعة على وثائق مشتركة يكتبها الأعضاء ويشكّلونها سوياً.',
    'group.docs.heading': 'اختاروا وثيقة للمتابعة',
    'group.docs.body': 'هذه هي الوثائق المشتركة للمجموعة. اضغطوا على إحداها للدخول والمشاركة.',
    'doc.title.heading': 'عنوان الوثيقة ووصفها',
    'doc.title.body': 'هنا يظهر اسم الوثيقة وخلفيتها — ما الذي تتناوله وما هدفها. اقرأوهما قبل التعمق في البنود.',
    'doc.counters.heading': 'بيانات المجتمع في لمحة سريعة',
    'doc.counters.body': 'تُظهر هذه الأرقام عدد المشاركين النشطين في الوثيقة، وعدد التعليقات المسجلة، ومستوى التوافق — وعدد الإصدارات المقبولة.',
    'doc.sections.heading': 'بنود الوثيقة',
    'doc.sections.body': 'الوثيقة مقسمة إلى مواضيع وبنود. كل بند يحتوي على محتوى أُنشئ بشكل تعاوني، ويمكن اقتراح تعديلات عليه.',
    'doc.title.counter.heading': 'اقرأوا عنوان الوثيقة ووصفها',
    'doc.title.counter.body': 'العنوان يخبركم عما تتناوله الوثيقة. الوصف يشرح السياق والهدف من إنشاء الوثيقة. هذا يساعدكم على فهم ما تبنيه المجتمع معاً.',
    'browse.explain.heading': 'لكل بند عدة نسخ',
    'browse.explain.body': 'يقترح أعضاء المجتمع تعديلات على كل بند. تتيح لكم الأسهم التنقل بينها ورؤية ما يقترحه كل شخص.',
    'browse.encourage.heading': 'لنتصفح الإصدارات المختلفة',
    'browse.encourage.body': 'لترى أي تعديلات اقترح المشاركون في النقاش لتحرير البند.',
    'comment.counter.encourage.heading': 'شاهدوا التعليقات الموجودة',
    'comment.counter.encourage.body': 'اضغطوا على عدد التعليقات لرؤية ما يقول الآخرون. هذه طريقة جيدة لفهم المقترح بعمق أكبر.',
    'section.hover.encourage.heading': 'مرروا المؤشر على البند لاقتراح تعديل',
    'section.hover.encourage.body': 'عندما تمررون المؤشر على بند، ستظهر أزرار تتيح لكم اقتراح تعديل أو حذف.',
    'new.section.hover.encourage.heading': 'مرروا المؤشر بين البنود لإضافة بند جديد',
    'new.section.hover.encourage.body': 'عندما تمررون المؤشر بين بندين، سيظهر زر لإضافة بند جديد في هذا الفراغ.',
    'browse.practice.heading': 'للتنقل بين اقتراحات التحرير المختلفة',
    'browse.practice.success': 'ممتاز. هكذا يمكن دائماً معرفة ما يقترحه المجتمع لكل جزء من الوثيقة',
    'vote.explain.heading': 'تصويتكم يشكّل الوثيقة',
    'vote.explain.body': 'كل صوت مهم. التصويت لصالح مقترح يقرّبه من القبول. التصويت ضده يبعده. المقترح الذي يحصل على دعم كافٍ سيدخل الوثيقة.',
    'vote.practice.heading': 'صوّتوا على مقترح وجدتموه مثيراً للاهتمام',
    'vote.practice.success': 'تم تسجيل تصويتكم وسيؤثر على نتيجة المقترح',
    'comment.explain.heading': 'هل لديكم ما تضيفونه؟',
    'comment.explain.body': 'تساعد التعليقات صاحب المقترح على فهم ما يناسب وما لا يناسب. هذا هو المكان للسؤال والشرح والإقناع.',
    'comment.practice.heading': 'اكتبوا تعليقاً قصيراً على أحد المقترحات',
    'comment.practice.success': 'تم نشر تعليقكم',
    'newclause.explain.heading': 'هل يغيب شيء عن الوثيقة؟',
    'newclause.explain.body': 'إذا رأيتم أن الوثيقة تحتاج إلى موضوع لم يُذكر بعد — يمكنكم اقتراح بند جديد كلياً. إذا وافق المجتمع، سيُضاف إلى الوثيقة.',
    'newclause.button.encourage.heading': 'هنا زر "إضافة بند"',
    'newclause.button.encourage.body': 'مرروا المؤشر أو اضغطوا على الشاشة أسفل البند الذي بعده تريدون إضافة بند جديد، واضغطوا على هذا الزر.',
    'newclause.select.topic.heading': 'اختاروا أي موضوع سيستقبل البند الجديد',
    'newclause.select.topic.body': 'سيتم إضافة البند الجديد إلى الموضوع الذي تختارونه. اختاروا الموضوع الأنسب من القائمة.',
    'newclause.content.heading': 'أدخلوا محتوى البند الجديد',
    'newclause.content.body': 'اكتبوا نص البند الجديد الذي تقترحونه.',
    'newclause.content.success': 'رائع! الآن يمكنكم إضافة شرح.',
    'newclause.explanation.heading': 'أضيفوا شرحاً (اختياري)',
    'newclause.explanation.body': 'اشرحوا لماذا تعتقدون أن هذا البند مهم. هذا سيساعد المجتمع على فهم اقتراحكم.',
    'newclause.submit.heading': 'شارِكوا اقتراحكم',
    'newclause.submit.body': 'اضغطوا على زر "إرسال" لنشر اقتراحكم. سيتمكن المجتمع من التصويت عليه.',
    'newclause.submit.success': 'تم نشر المقترح. يمكن للمجتمع الآن التصويت عليه',
    'editclause.explain.heading': 'لا توافقون على صياغة موجودة؟',
    'editclause.explain.body': 'يمكنكم اقتراح إعادة صياغة أي بند — أو اقتراح حذفه كلياً. هذه التغييرات أيضاً تخضع للتصويت ويمكنها تعديل الوثيقة.',
    'editclause.practice.heading': 'اختاروا بنداً موجوداً واقترحوا له صياغة مختلفة',
    'editclause.practice.success': 'تم نشر مقترح التعديل',
    'consensus.explain.heading': 'متى يُقبل المقترح؟',
    'consensus.explain.body': 'الأغلبية وحدها لا تكفي — نحتاج إلى توافق. يُقبل المقترح عندما يتجاوز فارق الأصوات لصالحه العتبة المطلوبة. تُحسب هذه العتبة من متوسط التوافق التاريخي للمجتمع: كلما اتُّخذت القرارات السابقة بتوافق أوسع، ارتفعت العتبة للموافقات القادمة.',
    'versions.explain.heading': 'الوثيقة حية ومتطورة',
    'versions.explain.body': 'كل مقترح قُبل أنشأ نسخة جديدة. في صفحة النسخ يمكنكم رؤية التاريخ الكامل — ما الذي تغيّر، ومتى، ومن اقترحه.',
    'versions.navigate.heading': 'افتحوا صفحة النسخ',
    'versions.navigate.success': 'هنا يُوثَّق كل تغيير وافق عليه المجتمع',
    'versions.browse.heading': 'اختاروا نسخة سابقة وشاهدوا ما تغيّر',
    'versions.browse.success': 'الأخضر = مُضاف، الأحمر = محذوف. هكذا تبدو الديمقراطية في العمل',
    'points.explain.heading': 'المساهمة الحقيقية تُكسب نقاطاً',
    'points.explain.body': 'تقديم مقترح يكلّف نقاطاً — هذا يُصفّي الضوضاء ويضمن جدية كل مقترح. لكن إذا حصل المقترح على دعم، ستستردون أكثر مما أنفقتم.',
    'points.explain.cost.edit': 'اقتراح تعديل بند',
    'points.explain.cost.new': 'اقتراح بند جديد',
    'points.explain.reward.upvote': 'كل تصويت لصالح مقترحكم',
    'points.explain.reward.aligned': 'التصويت في اتجاه المجتمع',
    'points.explain.reward.accepted': 'مقترح تم قبوله',
    'closing.heading': 'أنتم مستعدون للمساهمة',
    'closing.body': 'الآن تعرفون كيف تعمل Consenz. كل مقترح تقدمونه، وكل تصويت تمنحونه — يُشكّل هذه الوثيقة مع بقية المجتمع.',
    'closing.cta': 'لنبدأ',
    'nav.restart': 'جولة في المنصة',
    'signup.prompt.heading': 'للمتابعة يجب التسجيل',
    'signup.prompt.body': 'التسجيل مجاني ويستغرق ثوانٍ. بعد التسجيل ستعودون إلى هنا مباشرة.',
    'signup.prompt.cta': 'تسجيل',
  },
  en: {
    'home.groups.heading': 'Everything starts with a group',
    'home.groups.body': 'Each group manages shared documents. Click on a group to see its documents — and from there you can enter one.',
    'group.explain.heading': 'Welcome to the group',
    'group.explain.body': 'A group is a collaboration space — this is where discussions happen, changes are proposed, and decisions are made together. Each group contains shared documents that members write and shape collectively.',
    'group.docs.heading': 'Pick a document to continue',
    'group.docs.body': "These are the group's shared documents. Click one to enter and start participating.",
    'doc.title.heading': 'Document title and description',
    'doc.title.body': 'This shows the document name and its background — what it covers and what its purpose is. Read it before diving into the clauses.',
    'doc.counters.heading': 'Community stats at a glance',
    'doc.counters.body': 'These numbers show how many participants are active in the document, how many comments have been posted, the consensus level — and how many versions have been accepted.',
    'doc.sections.heading': 'Document sections',
    'doc.sections.body': 'The document is divided into topics and sections. Each section contains collaboratively created content, and you can propose changes to it.',
    'doc.title.counter.heading': 'Read the document title and description',
    'doc.title.counter.body': 'The title tells you what the document is about. The description explains the context and purpose. This helps you understand what the community is building together.',
    'browse.explain.heading': 'Each clause has multiple versions',
    'browse.explain.body': 'Community members propose changes to each clause. Use the arrows to browse between proposals and see what each one suggests.',
    'browse.encourage.heading': 'Let\'s browse between versions',
    'browse.encourage.body': 'To see what changes participants in the discussion proposed for editing this section.',
    'comment.counter.encourage.heading': 'See the existing comments',
    'comment.counter.encourage.body': 'Click the comment count to see what others are saying. It\'s a good way to understand the proposal more deeply.',
    'section.hover.encourage.heading': 'Hover on a section to propose changes',
    'section.hover.encourage.body': 'When you hover on a section, buttons will appear that let you propose an edit or deletion.',
    'new.section.hover.encourage.heading': 'Hover between sections to add a new one',
    'new.section.hover.encourage.body': 'When you hover between two sections, a button will appear to add a new section in that space.',
    'browse.practice.heading': 'To browse between different edit proposals',
    'browse.practice.success': 'Nice — you can always flip through proposals this way',
    'vote.explain.heading': 'Your vote shapes the document',
    'vote.explain.body': 'Every vote counts. Voting for a proposal brings it closer to approval. Voting against pushes it away. The proposal with enough support becomes part of the document.',
    'vote.practice.heading': 'Vote on a proposal you find interesting',
    'vote.practice.success': 'Your vote has been counted and will affect the outcome',
    'comment.explain.heading': 'Have something to add?',
    'comment.explain.body': "Comments help the author understand what works and what doesn't. This is the place to ask, explain, or persuade.",
    'comment.practice.heading': 'Write a short comment on any proposal',
    'comment.practice.success': 'Your comment is live',
    'newclause.explain.heading': 'Something missing from the document?',
    'newclause.explain.body': 'If you think the document needs a topic that isn\'t covered yet — you can propose an entirely new clause. If the community agrees, it will be added to the document.',
    'newclause.button.encourage.heading': 'Here\'s the "Add section" button',
    'newclause.button.encourage.body': 'Hover your mouse or tap on the screen below the section after which you want to add a new clause, and click this button.',
    'newclause.select.topic.heading': 'Choose which topic will receive the new section',
    'newclause.select.topic.body': 'The new section will be added to the topic you choose. Select the most appropriate topic from the list.',
    'newclause.content.heading': 'Enter the content of the new section',
    'newclause.content.body': 'Write the text of the new section you\'re proposing.',
    'newclause.content.success': 'Great! Now you can add an explanation.',
    'newclause.explanation.heading': 'Add an explanation (optional)',
    'newclause.explanation.body': 'Explain why you think this section is important. This will help the community understand your proposal.',
    'newclause.submit.heading': 'Submit your proposal',
    'newclause.submit.body': 'Click the "Submit" button to publish your proposal. The community will be able to vote on it.',
    'newclause.submit.success': 'Your proposal is live. The community can now vote on it',
    'editclause.explain.heading': 'Disagree with existing wording?',
    'editclause.explain.body': 'You can propose rewording any clause — or propose deleting it entirely. These changes go through a vote too, and they can change the document.',
    'editclause.practice.heading': 'Pick an existing clause and propose different wording',
    'editclause.practice.success': 'Your change proposal is live',
    'consensus.explain.heading': 'When does a proposal get accepted?',
    'consensus.explain.body': 'A majority isn\'t enough — you need consensus. A proposal passes when the gap between for and against votes crosses the threshold. The threshold is calculated from the community\'s historical agreement average: the broader the consensus on past decisions, the higher the bar for future approvals. The document holds itself to a higher standard as it matures.',
    'versions.explain.heading': 'The document is alive and evolving',
    'versions.explain.body': 'Every accepted proposal created a new version. In the versions page you can see the full history — what changed, when, and by whom.',
    'versions.navigate.heading': 'Open the version history page',
    'versions.navigate.success': 'Every change the community approved is documented here',
    'versions.browse.heading': 'Select a previous version to see what changed',
    'versions.browse.success': 'Green = added, red = removed. This is democracy in action',
    'points.explain.heading': 'Real contributions earn points',
    'points.explain.body': 'Submitting a proposal costs points — this filters noise and ensures every proposal is serious. But if your proposal earns support, you get back far more than you invested.',
    'points.explain.cost.edit': 'Propose a clause edit',
    'points.explain.cost.new': 'Propose a new clause',
    'points.explain.reward.upvote': 'Each upvote on your proposal',
    'points.explain.reward.aligned': 'Voting in line with the community',
    'points.explain.reward.accepted': 'Proposal accepted',
    'closing.heading': 'You\'re ready to contribute',
    'closing.body': 'Now you know how Consenz works. Every proposal you submit, every vote you cast — shapes this document together with the rest of the community.',
    'closing.cta': 'Let\'s go',
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
 * Mid-tutorial steps shown on the group page.
 * Step 1: Explain what a group is.
 * Step 2: Guide user to click a document.
 */
export const GROUP_EXPLAIN_STEP = {
  id: 'group-explain',
  type: 'explain',
  targetSelector: '.group-header',
  tooltipPosition: 'bottom',
  heading: 'group.explain.heading',
  body: 'group.explain.body',
};

export const GROUP_INTRO_STEP = {
  id: 'group-intro',
  type: 'practice',
  targetSelector: '.group-documents-list',
  tooltipPosition: 'bottom',
  heading: 'group.docs.heading',
  body: 'group.docs.body',
  successMessage: 'מעולה, בואו נתחיל',
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
  successMessage: 'מעולה, בואו נתחיל',
  completionEvent: 'document:entered',
};

/** @type {Array} */
export const TUTORIAL_STEPS = [
  // 1. Foundation: Document title & description
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
  
  // 3. Document structure
  {
    id: 'doc-sections-explain',
    type: 'explain',
    targetSelector: '.document-sections-area',
    tooltipPosition: 'top',
    heading: 'doc.sections.heading',
    body: 'doc.sections.body',
  },
  
  // 4. Voting (core mechanic)
  {
    id: 'vote-explain',
    type: 'explain',
    targetSelector: '.proposal-vote-buttons',
    tooltipPosition: 'top',
    heading: 'vote.explain.heading',
    body: 'vote.explain.body',
  },
  
  // 5. Consensus threshold
  {
    id: 'consensus-explain',
    type: 'explain',
    targetSelector: '.consensus-meter',
    tooltipPosition: 'bottom',
    heading: 'consensus.explain.heading',
    body: 'consensus.explain.body',
  },
  
  // 6. Points system (before participation)
  {
    id: 'points-explain',
    type: 'explain',
    targetSelector: '.user-points-badge',
    tooltipPosition: 'bottom',
    heading: 'points.explain.heading',
    body: 'points.explain.body',
    table: [
      { label: 'points.explain.cost.edit',       value: '−200' },
      { label: 'points.explain.cost.new',        value: '−350' },
      { label: 'points.explain.reward.upvote',   value: '+10'  },
      { label: 'points.explain.reward.aligned',  value: '+50'  },
      { label: 'points.explain.reward.accepted', value: '+500' },
    ],
  },
  
  // 7. Viewing comments (before writing them)
  {
    id: 'comment-counter-encourage',
    type: 'encourage',
    targetSelector: '.proposal-comments-counter',
    tooltipPosition: 'top',
    heading: 'comment.counter.encourage.heading',
    body: 'comment.counter.encourage.body',
  },
  
  // 8. Writing comments
  {
    id: 'comment-explain',
    type: 'explain',
    targetSelector: '.proposal-comment-input',
    tooltipPosition: 'top',
    heading: 'comment.explain.heading',
    body: 'comment.explain.body',
  },
  
  // 9. Hovering on sections (edit affordance)
  {
    id: 'section-hover-encourage',
    type: 'encourage',
    targetSelector: '.section-card',
    tooltipPosition: 'bottom',
    heading: 'section.hover.encourage.heading',
    body: 'section.hover.encourage.body',
  },
  
  // 10. Browsing proposals (viewing versions)
  {
    id: 'browse-explain',
    type: 'explain',
    targetSelector: '.proposal-navigation-arrows',
    tooltipPosition: 'bottom',
    heading: 'browse.explain.heading',
    body: 'browse.explain.body',
  },
  
  // 11. Browsing encouragement
  {
    id: 'browse-encourage',
    type: 'encourage',
    targetSelector: '.proposal-navigation-arrows',
    tooltipPosition: 'bottom',
    heading: 'browse.encourage.heading',
    body: 'browse.encourage.body',
  },
  
  // 12. Why edit proposals exist
  {
    id: 'edit-proposals-explain',
    type: 'explain',
    targetSelector: '.proposal-navigation-arrows',
    tooltipPosition: 'bottom',
    heading: 'browse.explain.heading',
    body: 'browse.explain.body',
  },
  
  // 13. Edit existing section (practice)
  {
    id: 'editclause-explain',
    type: 'explain',
    targetSelector: '.clause-edit-button',
    tooltipPosition: 'top',
    heading: 'editclause.explain.heading',
    body: 'editclause.explain.body',
  },
  
  {
    id: 'editclause-practice',
    type: 'practice',
    requiresAuth: true,
    targetSelector: '.clause-edit-button',
    tooltipPosition: 'top',
    heading: 'editclause.practice.heading',
    body: '',
    successMessage: 'editclause.practice.success',
    completionEvent: 'proposal:clause-edited',
  },
  
  // 13-14. New section workflow
  {
    id: 'newclause-explain',
    type: 'explain',
    targetSelector: '.add-clause-button',
    tooltipPosition: 'bottom',
    heading: 'newclause.explain.heading',
    body: 'newclause.explain.body',
  },
  
  {
    id: 'newclause-button-encourage',
    type: 'encourage',
    requiresAuth: true,
    targetSelector: '.add-clause-button',
    tooltipPosition: 'bottom',
    heading: 'newclause.button.encourage.heading',
    body: 'newclause.button.encourage.body',
    completionEvent: 'create-suggestion-modal:opened',
  },
  
  {
    id: 'newclause-select-topic',
    type: 'encourage',
    requiresAuth: true,
    targetSelector: '.create-suggestion-modal select, .create-suggestion-modal [role="combobox"]',
    tooltipPosition: 'top',
    heading: 'newclause.select.topic.heading',
    body: 'newclause.select.topic.body',
  },
  
  {
    id: 'newclause-content',
    type: 'practice',
    requiresAuth: true,
    targetSelector: '.create-suggestion-modal [placeholder*="תוכן"], .create-suggestion-modal textarea[placeholder*="Content"], .create-suggestion-modal textarea[placeholder*="محتوى"]',
    tooltipPosition: 'top',
    heading: 'newclause.content.heading',
    body: 'newclause.content.body',
    successMessage: 'newclause.content.success',
    completionEvent: 'newclause-content:filled',
  },
  
  {
    id: 'newclause-explanation',
    type: 'encourage',
    requiresAuth: true,
    targetSelector: '.create-suggestion-modal [placeholder*="הסבר"], .create-suggestion-modal input[placeholder*="Explanation"], .create-suggestion-modal input[placeholder*="شرح"]',
    tooltipPosition: 'top',
    heading: 'newclause.explanation.heading',
    body: 'newclause.explanation.body',
  },
  
  {
    id: 'newclause-submit',
    type: 'practice',
    requiresAuth: true,
    targetSelector: '.create-suggestion-modal button[type="submit"]',
    tooltipPosition: 'top',
    heading: 'newclause.submit.heading',
    body: 'newclause.submit.body',
    successMessage: 'newclause.submit.success',
    completionEvent: 'proposal:clause-added',
  },
  
  // 15. Inserting between sections
  {
    id: 'new-section-hover-encourage',
    type: 'encourage',
    targetSelector: '.section-insert-space',
    tooltipPosition: 'bottom',
    heading: 'new.section.hover.encourage.heading',
    body: 'new.section.hover.encourage.body',
  },
  
  // 16. Version history
  {
    id: 'versions-explain',
    type: 'explain',
    targetSelector: '.versions-tab-button',
    tooltipPosition: 'bottom',
    heading: 'versions.explain.heading',
    body: 'versions.explain.body',
  },
  
  {
    id: 'versions-navigate',
    type: 'practice',
    targetSelector: '.versions-tab-button',
    tooltipPosition: 'bottom',
    heading: 'versions.navigate.heading',
    body: '',
    successMessage: 'versions.navigate.success',
    completionEvent: 'versions:opened',
  },
  
  {
    id: 'versions-browse',
    type: 'practice',
    targetSelector: '.versions-list',
    tooltipPosition: 'right',
    heading: 'versions.browse.heading',
    body: '',
    successMessage: 'versions.browse.success',
    completionEvent: 'versions:selected',
  },
  
  // 17. Closing screen
  {
    id: 'closing',
    type: 'closing',
    targetSelector: null,
    tooltipPosition: null,
    heading: 'closing.heading',
    body: 'closing.body',
    cta: 'closing.cta',
  },
];