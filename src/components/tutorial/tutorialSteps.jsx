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
    'home.groups.heading': 'קבוצה היא מרחב שיתוף פעולה',
    'home.groups.body': 'חברי הקבוצה כותבים מסמכים ביחד, מציעים שינויים, ומצביעים על כל הצעה. לחצו על קבוצה כדי לראות את המסמכים שלה ולהתחיל להשתתף.',
    'group.explain.heading': 'ברוכים הבאים לקבוצה',
    'group.explain.body': 'קבוצה היא מרחב שיתוף פעולה — כאן מתנהלים דיונים, מוצעות שינויים ומתקבלות החלטות יחד. כל קבוצה מכילה מסמכים משותפים שהחברים בה כותבים ומעצבים ביחד.',
    'group.docs.heading': 'בחרו מסמך כדי להמשיך',
    'group.docs.body': 'אלה המסמכים המשותפים של הקבוצה. לחצו על אחד מהם כדי להיכנס ולהתחיל להשתתף.',
    'doc.title.heading': 'כותרת המסמך ותיאורו',
    'doc.title.body': 'כאן מופיעים שם המסמך והרקע שלו — מה הוא עוסק בו ומה מטרתו. קראו אותו לפני שצוללים לסעיפים.',
    'doc.counters.heading': 'נתוני המסמך במבט מהיר',
    'doc.counters.body': 'הספרות האלה מראות כמה משתתפים פועלים במסמך, כמה תגובות נרשמו, מה רמת הקונצנזוס — וכמה גרסאות כבר התקבלו. אפשר ללחוץ על כל נתון כדי לקבל מידע נוסף: רשימת המשתתפים, הסבר על מד הקונצנזוס, וצפייה בגרסאות המסמך.',
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
    'newclause.hover.heading': 'העמידו את העכבר בין סעיפים כדי להוסיף סעיף חדש',
    'newclause.hover.body': 'כשתעמידו את העכבר בין שני סעיפים, יופיע כפתור להוספת סעיף חדש. כפתור הארה זה יראה לכם את הכפתור גם ללא ריחוף.',
    'newclause.button.heading': 'לחצו על כפתור "הוסף סעיף"',
    'newclause.button.body': 'לחיצה על הכפתור תפתח חלון לכתיבת ההצעה החדשה שלכם.',
    'newclause.modal.heading': 'חלון ההצעה החדשה נפתח',
    'newclause.modal.body': 'כאן תוכלו למלא את פרטי הסעיף החדש — תוכן, נושא, והסבר. כשהבנתם את התהליך, אפשר לסגור את החלון ולהמשיך בסיור.',
    'editclause.explain.heading': 'סעיפי המסמך — ואיך משנים אותם',
    'editclause.explain.body': 'המסמך מחולק לנושאים וסעיפים. לא מסכימים עם נוסח הסעיף? אפשר לפרסם הצעה לשינוי או למחיקת הסעיף. כל הצעה תועמד להצבעה, ואם תקבל מספיק תמיכה תתווסף אוטומטית למסמך.',
    'editclause.hover.heading': 'העמידו את העכבר על סעיף כדי לחשוף את כפתורי העריכה',
    'editclause.hover.body': 'ברגע שתעמידו את העכבר על סעיף, יופיעו כפתורים להצעת שינויים. כפתור הארה זה יראה לכם את הכפתורים גם ללא ריחוף, כדי שתהיו בטוחים איפה הם נמצאים.',
    'editclause.buttons.heading': 'כפתורי הצעת עריכה ומחיקה',
    'editclause.buttons.body': 'אלה הכפתורים להצעת עריכה או מחיקת הסעיף — הם מוצגים כשמעבירים את סמן העכבר מעל הסעיף, או בלחיצה על הסעיף במסך מגע.',
    'editclause.modal.heading': 'חלון הצעת השינוי נפתח',
    'editclause.modal.body': 'כאן תזינו את השינוי המוצע ואת ההסבר עבור חברי הקהילה. כשהבנתם כיצד מתחילים, אפשר לסגור את החלון ולהמשיך בסיור.',
    'deleteclause.explain.heading': 'לא רוצים סעיף זה במסמך?',
    'deleteclause.explain.body': 'אפשר להציע למחוק סעיף קיים אם לדעתכם הוא לא רלוונטי או לא מדויק. הקהילה תצביע על הצעת המחיקה, כמו על כל שינוי אחר.',
    'consensus.meter.heading': 'מד הקונסנזוס מראה קרבה לאישור',
    'consensus.meter.body': 'הבר הזה מראה כמה קולות דרושים כדי שהצעה תתקבל. זה תלוי בהסכמה ההיסטורית של הקהילה — המסמכים בשלים דורשים הסכמה יותר רחבה.',
    'versions.counter.heading': 'קאונטר הגרסאות ממעיל את ההיסטוריה',
    'versions.counter.body': 'המספר הזה מראה כמה גרסאות של המסמך קיימות כרגע. כל גרסה היא מצב שנאישר על ידי הקהילה.',
    'cleanview.browse.heading': 'דפדוף בין גרסאות קודמות',
    'cleanview.browse.body': 'בחרו בגרסה קודמת כדי לראות איך המסמך נראה בשלב קודם.',
    'cleanview.diff.heading': 'זיהוי סוגי השינויים',
    'cleanview.diff.body': 'ירוק = תוכן שנוסף, אדום = תוכן שהוסר. כך תוכלו להבין בדיוק מה השתנה.',
    'cleanview.discussion.heading': 'פרטי הדיון על השינוי',
    'cleanview.discussion.body': 'לחצו לראות את הדיון המלא — הצעות, הצבעות, ותגובות שהובילו להחלטה הזאת.',
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
    'home.groups.heading': 'المجموعة هي فضاء للتعاون',
    'home.groups.body': 'يكتب أعضاء المجموعة وثائق معاً، يقترحون تعديلات، ويصوتون على كل اقتراح. اضغطوا على مجموعة لرؤية وثائقها والمشاركة.',
    'group.explain.heading': 'مرحباً بكم في المجموعة',
    'group.explain.body': 'المجموعة هي فضاء للتعاون — هنا تجري النقاشات، تُقترح التعديلات وتُتخذ القرارات معاً. تحتوي كل مجموعة على وثائق مشتركة يكتبها الأعضاء ويشكّلونها سوياً.',
    'group.docs.heading': 'اختاروا وثيقة للمتابعة',
    'group.docs.body': 'هذه هي الوثائق المشتركة للمجموعة. اضغطوا على إحداها للدخول والمشاركة.',
    'doc.title.heading': 'عنوان الوثيقة ووصفها',
    'doc.title.body': 'هنا يظهر اسم الوثيقة وخلفيتها — ما الذي تتناوله وما هدفها. اقرأوهما قبل التعمق في البنود.',
    'doc.counters.heading': 'بيانات الوثيقة في لمحة سريعة',
    'doc.counters.body': 'تُظهر هذه الأرقام عدد المشاركين النشطين في الوثيقة، وعدد التعليقات المسجلة، ومستوى التوافق — وعدد الإصدارات المقبولة. يمكنكم الضغط على كل رقم للحصول على مزيد من المعلومات: قائمة المشاركين، شرح مقياس التوافق، وعرض إصدارات الوثيقة.',
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
    'editclause.explain.heading': 'بنود الوثيقة — وكيفية تعديلها',
    'editclause.explain.body': 'الوثيقة مقسمة إلى مواضيع وبنود، وكل بند هو محتوى أُنشئ بشكل تعاوني. لا توافقون على صياغة موجودة؟ يمكنكم اقتراح إعادة صياغة أي بند — أو اقتراح حذفه كلياً. هذه التغييرات أيضاً تخضع للتصويت، وإذا وافق المجتمع — ستُدرج في الوثيقة.',
    'editclause.buttons.heading': 'أزرار اقتراح التعديل والحذف',
    'editclause.buttons.body': 'هذه هي الأزرار لاقتراح تعديل البند أو حذفه — تظهر عند تمرير مؤشر الماوس فوق البند، أو عند الضغط على البند في شاشات اللمس.',
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
    'home.groups.heading': 'A group is a collaboration space',
    'home.groups.body': 'Group members write documents together, propose changes, and vote on every suggestion. Click a group to see its documents and start participating.',
    'group.explain.heading': 'Welcome to the group',
    'group.explain.body': 'A group is a collaboration space — this is where discussions happen, changes are proposed, and decisions are made together. Each group contains shared documents that members write and shape collectively.',
    'group.docs.heading': 'Pick a document to continue',
    'group.docs.body': "These are the group's shared documents. Click one to enter and start participating.",
    'doc.title.heading': 'Document title and description',
    'doc.title.body': 'This shows the document name and its background — what it covers and what its purpose is. Read it before diving into the clauses.',
    'doc.counters.heading': 'Document stats at a glance',
    'doc.counters.body': 'These numbers show how many participants are active in the document, how many comments have been posted, the consensus level — and how many versions have been accepted. You can click each stat to learn more: see the participants list, understand the consensus meter, or browse document versions.',
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
    'editclause.explain.heading': 'Document sections — and how to change them',
    'editclause.explain.body': 'The document is divided into topics and sections, each one collaboratively created content. Disagree with existing wording? You can propose rewording any clause — or propose deleting it entirely. These changes go through a vote too, and if the community agrees, they become part of the document.',
    'editclause.buttons.heading': 'Edit and delete proposal buttons',
    'editclause.buttons.body': 'These are the buttons to propose an edit or deletion for a section — they appear when you hover your mouse over the section, or when you tap the section on a touch screen.',
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
  },
  
  // 6. Browsing encouragement — Next unlocks only after user browses
  {
    id: 'browse-encourage',
    type: 'practice',
    targetSelector: '.section-card',
    tooltipPosition: 'bottom',
    heading: 'browse.encourage.heading',
    body: 'browse.encourage.body',
    completionEvent: 'carousel:navigated',
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
  
  // 8. Writing comments
  {
    id: 'comment-explain',
    type: 'explain',
    targetSelector: '.proposal-comment-input',
    tooltipPosition: 'top',
    heading: 'comment.explain.heading',
    body: 'comment.explain.body',
  },
  
  // 9. Submit comment practice
  {
    id: 'comment-practice',
    type: 'encourage',
    requiresAuth: true,
    targetSelector: '.proposal-comment-input',
    tooltipPosition: 'top',
    heading: 'comment.practice.heading',
    body: 'comment.practice.body',
    completionEvent: 'comment:submitted',
  },
  
  // 10. Edit existing clause - discovery
  {
    id: 'editclause-hover',
    type: 'encourage',
    requiresAuth: true,
    targetSelector: '.section-card',
    tooltipPosition: 'bottom',
    heading: 'editclause.hover.heading',
    body: 'editclause.hover.body',
  },
  
  // 11. Edit - modal opening
  {
    id: 'editclause-modal',
    type: 'encourage',
    requiresAuth: true,
    targetSelector: '.create-suggestion-modal',
    tooltipPosition: 'bottom',
    heading: 'editclause.modal.heading',
    body: 'editclause.modal.body',
    completionEvent: 'create-suggestion-modal:opened',
  },
  
  // 12. Delete section - explain
  {
    id: 'deleteclause-explain',
    type: 'explain',
    targetSelector: '.section-card',
    tooltipPosition: 'bottom',
    heading: 'deleteclause.explain.heading',
    body: 'deleteclause.explain.body',
  },
  
  // 13. New section - explain concept
  {
    id: 'newclause-explain',
    type: 'explain',
    targetSelector: '.section-insert-space',
    tooltipPosition: 'bottom',
    heading: 'newclause.explain.heading',
    body: 'newclause.explain.body',
  },
  
  // 14. New section - hover discovery (includes affordance)
  {
    id: 'newclause-hover',
    type: 'encourage',
    requiresAuth: true,
    targetSelector: '.section-insert-space',
    tooltipPosition: 'bottom',
    heading: 'newclause.hover.heading',
    body: 'newclause.hover.body',
  },
  
  // 15. New section - button click
  {
    id: 'newclause-button',
    type: 'encourage',
    requiresAuth: true,
    targetSelector: '.add-clause-button',
    tooltipPosition: 'bottom',
    heading: 'newclause.button.heading',
    body: 'newclause.button.body',
    completionEvent: 'create-suggestion-modal:opened',
  },
  
  // 16. New section - modal opening
  {
    id: 'newclause-modal',
    type: 'encourage',
    requiresAuth: true,
    targetSelector: '.create-suggestion-modal',
    tooltipPosition: 'bottom',
    heading: 'newclause.modal.heading',
    body: 'newclause.modal.body',
  },
  
  // 17. Consensus meter explanation
  {
    id: 'consensus-meter-explain',
    type: 'explain',
    targetSelector: '.consensus-meter',
    tooltipPosition: 'bottom',
    heading: 'consensus.meter.heading',
    body: 'consensus.meter.body',
  },
  
  // 18. Versions counter
  {
    id: 'versions-counter-explain',
    type: 'explain',
    targetSelector: '[data-testid="versions-counter"]',
    tooltipPosition: 'bottom',
    heading: 'versions.counter.heading',
    body: 'versions.counter.body',
  },
  
  // 19. Encourage entering versions page
  {
    id: 'versions-navigate',
    type: 'encourage',
    targetSelector: '.versions-tab-button',
    tooltipPosition: 'bottom',
    heading: 'versions.navigate.heading',
    body: 'versions.navigate.body',
    completionEvent: 'versions:opened',
  },
  
  // 20. DocumentCleanView - browse previous versions
  {
    id: 'cleanview-browse',
    type: 'explain',
    targetSelector: '.versions-list',
    tooltipPosition: 'right',
    heading: 'cleanview.browse.heading',
    body: 'cleanview.browse.body',
  },
  
  // 21. DocumentCleanView - identify changes
  {
    id: 'cleanview-diff',
    type: 'explain',
    targetSelector: '.document-diff',
    tooltipPosition: 'left',
    heading: 'cleanview.diff.heading',
    body: 'cleanview.diff.body',
  },
  
  // 22. DocumentCleanView - discussion details
  {
    id: 'cleanview-discussion',
    type: 'encourage',
    targetSelector: '.suggestion-details-link, [data-testid="discussion-button"]',
    tooltipPosition: 'bottom',
    heading: 'cleanview.discussion.heading',
    body: 'cleanview.discussion.body',
  },
  
  // 23. Closing screen
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