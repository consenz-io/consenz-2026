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
];