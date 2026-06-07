/**
 * TutorialStep interface:
 * {
 *   id: string,
 *   type: 'explain' | 'practice',
 *   targetSelector: string,
 *   tooltipPosition: 'top' | 'bottom' | 'left' | 'right' | 'auto',
 *   heading: string,           // i18n key
 *   body: string,              // i18n key (empty string = no body)
 *   successMessage?: string,   // i18n key
 *   completionEvent?: string
 * }
 */

export const tutorialStrings = {
  he: {
    'browse.explain.heading': 'לכל סעיף יש כמה גרסאות',
    'browse.explain.body': 'חברי הקהילה מציעים שינויים לכל סעיף. החצים מאפשרים לעבור ביניהם ולראות מה כל אחד מציע.',
    'browse.practice.heading': 'השתמשו בחצים כדי לעבור בין ההצעות לאחד הסעיפים',
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
    'newclause.practice.heading': 'לחצו על "הוסף סעיף" והציעו תוכן שלדעתכם חסר במסמך',
    'newclause.practice.success': 'ההצעה פורסמה. הקהילה יכולה עכשיו להצביע עליה',
    'editclause.explain.heading': 'לא מסכימים עם ניסוח קיים?',
    'editclause.explain.body': 'אפשר להציע לנסח מחדש כל סעיף — או להציע למחוק אותו לגמרי. גם שינויים כאלה עוברים הצבעה, וגם הם יכולים לשנות את המסמך.',
    'editclause.practice.heading': 'בחרו סעיף קיים והציעו לו ניסוח אחר',
    'editclause.practice.success': 'הצעת השינוי פורסמה',
  },
  ar: {
    'browse.explain.heading': 'لكل بند عدة نسخ',
    'browse.explain.body': 'يقترح أعضاء المجتمع تعديلات على كل بند. تتيح لكم الأسهم التنقل بينها ورؤية ما يقترحه كل شخص.',
    'browse.practice.heading': 'استخدموا الأسهم للتنقل بين المقترحات',
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
    'newclause.practice.heading': 'اضغطوا على "إضافة بند" واقترحوا محتوى ترون أنه مفقود',
    'newclause.practice.success': 'تم نشر المقترح. يمكن للمجتمع الآن التصويت عليه',
    'editclause.explain.heading': 'لا توافقون على صياغة موجودة؟',
    'editclause.explain.body': 'يمكنكم اقتراح إعادة صياغة أي بند — أو اقتراح حذفه كلياً. هذه التغييرات أيضاً تخضع للتصويت ويمكنها تعديل الوثيقة.',
    'editclause.practice.heading': 'اختاروا بنداً موجوداً واقترحوا له صياغة مختلفة',
    'editclause.practice.success': 'تم نشر مقترح التعديل',
  },
  en: {
    'browse.explain.heading': 'Each clause has multiple versions',
    'browse.explain.body': 'Community members propose changes to each clause. Use the arrows to browse between proposals and see what each one suggests.',
    'browse.practice.heading': 'Use the arrows to browse proposals on any clause',
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
    'newclause.practice.heading': 'Click "Add clause" and propose content you think is missing',
    'newclause.practice.success': 'Your proposal is live. The community can now vote on it',
    'editclause.explain.heading': 'Disagree with existing wording?',
    'editclause.explain.body': 'You can propose rewording any clause — or propose deleting it entirely. These changes go through a vote too, and they can change the document.',
    'editclause.practice.heading': 'Pick an existing clause and propose different wording',
    'editclause.practice.success': 'Your change proposal is live',
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
 * Pre-tutorial step shown on the home page.
 * No progress dots, no scrim — spotlight only on .documents-list.
 */
export const HOME_INTRO_STEP = {
  id: 'home-intro',
  type: 'practice',
  targetSelector: '.documents-list',
  tooltipPosition: 'bottom',
  heading: 'איך מתחילים?',
  body: 'כדי להתחיל, בחר מסמך מהרשימה כאן למטה — הסיור המלא יחכה לך בפנים.',
  successMessage: 'מעולה, בואו נתחיל',
  completionEvent: 'document:entered',
};

/** @type {Array} */
export const TUTORIAL_STEPS = [
  {
    id: 'browse-explain',
    type: 'explain',
    targetSelector: '.proposal-navigation-arrows',
    tooltipPosition: 'bottom',
    heading: 'browse.explain.heading',
    body: 'browse.explain.body',
  },
  {
    id: 'browse-practice',
    type: 'practice',
    targetSelector: '.proposal-navigation-arrows',
    tooltipPosition: 'bottom',
    heading: 'browse.practice.heading',
    body: '',
    successMessage: 'browse.practice.success',
    completionEvent: 'proposal:navigated',
  },
  {
    id: 'vote-explain',
    type: 'explain',
    targetSelector: '.proposal-vote-buttons',
    tooltipPosition: 'top',
    heading: 'vote.explain.heading',
    body: 'vote.explain.body',
  },
  {
    id: 'vote-practice',
    type: 'practice',
    targetSelector: '.proposal-vote-buttons',
    tooltipPosition: 'top',
    heading: 'vote.practice.heading',
    body: '',
    successMessage: 'vote.practice.success',
    completionEvent: 'proposal:voted',
  },
  {
    id: 'comment-explain',
    type: 'explain',
    targetSelector: '.proposal-comment-input',
    tooltipPosition: 'top',
    heading: 'comment.explain.heading',
    body: 'comment.explain.body',
  },
  {
    id: 'comment-practice',
    type: 'practice',
    targetSelector: '.proposal-comment-input',
    tooltipPosition: 'top',
    heading: 'comment.practice.heading',
    body: '',
    successMessage: 'comment.practice.success',
    completionEvent: 'proposal:commented',
  },
  {
    id: 'newclause-explain',
    type: 'explain',
    targetSelector: '.add-clause-button',
    tooltipPosition: 'bottom',
    heading: 'newclause.explain.heading',
    body: 'newclause.explain.body',
  },
  {
    id: 'newclause-practice',
    type: 'practice',
    targetSelector: '.add-clause-button',
    tooltipPosition: 'bottom',
    heading: 'newclause.practice.heading',
    body: '',
    successMessage: 'newclause.practice.success',
    completionEvent: 'proposal:clause-added',
  },
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
    targetSelector: '.clause-edit-button',
    tooltipPosition: 'top',
    heading: 'editclause.practice.heading',
    body: '',
    successMessage: 'editclause.practice.success',
    completionEvent: 'proposal:clause-edited',
  },
];