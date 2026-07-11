// Extract title suffix after the first colon
const extractTitle = (description) => {
  const desc = description || '';
  return desc.split(':').slice(1).join(':').trim() || '';
};

// Translation helper for transaction descriptions.
// Centralised so both FloatingPointsBadge and PointsHistoryList share one source of truth.
// When a new language is added, update only the ternary branches below.
export const translateTransactionDescription = (transaction, language) => {
  const description = transaction?.description || transaction || '';
  const action = transaction?.action;
  const title = extractTitle(description);

  if (action === 'suggestion_created') {
    return language === 'he' ? 'יצירת הצעה חדשה' : language === 'ar' ? 'تم إنشاء اقتراح' : 'Created suggestion';
  }
  if (action === 'suggestion_accepted') {
    return language === 'he' ? 'הצעתך התקבלה' : language === 'ar' ? 'تم قبول اقتراحك' : 'Your suggestion was accepted';
  }
  if (action === 'vote_received') {
    return language === 'he' ? 'קיבלת הצבעה בעד' : language === 'ar' ? 'تلقيت تصويتًا مع' : 'Received a pro vote';
  }
  if (action === 'vote_canceled') {
    if (description.includes('החזר נקודות') || description.includes('refund') || description.includes('Refund')) {
      return language === 'he' ? 'החזר נקודות — הצעה נדחתה ע״י מנהל/ת' : language === 'ar' ? 'استرداد نقاط — تم رفض الاقتراح من قِبل المشرف' : 'Points refunded — suggestion rejected by admin';
    }
    return language === 'he' ? 'הצבעה בוטלה' : language === 'ar' ? 'تم إلغاء التصويت' : 'Vote canceled';
  }
  if (action === 'vote_influenced_acceptance') {
    const isRejection = description.includes('דחיית') || description.includes('rejection') || description.includes('rejected') || description.includes('رفض');
    return isRejection
      ? (language === 'he' ? 'הצבעתך השפיעה על דחיית הצעה' : language === 'ar' ? 'أثّر تصويتك على رفض اقتراح' : 'Your vote influenced suggestion rejection')
      : (language === 'he' ? 'הצבעתך השפיעה על קבלת הצעה' : language === 'ar' ? 'أثّر تصويتك على قبول اقتراح' : 'Your vote influenced suggestion acceptance');
  }
  if (action === 'comment_like_received') {
    return language === 'he' ? 'קיבלת לייק על תגובה' : language === 'ar' ? 'حصلت على إعجاب على تعليق' : 'Comment like received';
  }
  if (action === 'comment_like_removed') {
    return language === 'he' ? 'בוטל לייק על תגובה' : language === 'ar' ? 'تم إلغاء إعجاب على تعليق' : 'Comment like removed';
  }

  // Fallback: pattern matching on stored description text (for legacy records without action field)
  const d = description;
  if (d.includes('הצעתך לסעיף חדש התקבלה') || d.includes('new section suggestion accepted')) {
    return language === 'he' ? `הצעתך לסעיף חדש התקבלה` : language === 'ar' ? `تم قبول اقتراح قسم جديد: ${title}` : `New section suggestion accepted: ${title}`;
  }
  if (d.includes('הצעתך לשינוי סעיף התקבלה') || d.includes('section edit accepted')) {
    return language === 'he' ? `הצעתך לעריכת סעיף התקבלה` : language === 'ar' ? `تم قبول اقتراح تعديل قسم: ${title}` : `Section edit accepted: ${title}`;
  }
  if (d.includes('הצעה למחיקת סעיף') || d.includes('section deletion accepted')) {
    return language === 'he' ? `הצעתך למחיקת סעיף התקבלה` : language === 'ar' ? `تم قبول اقتراح حذف قسم: ${title}` : `Section deletion accepted: ${title}`;
  }
  if (d.includes('ההצעה שלך התקבלה') || d.includes('your suggestion was accepted')) {
    return language === 'he' ? `הצעה שלך התקבלה` : language === 'ar' ? `تم قبول اقتراحك: ${title}` : `Your suggestion was accepted: ${title}`;
  }
  if (d.includes('הצעתך לעריכת כותרת נושא התקבלה') || d.includes('topic title edit was accepted')) {
    return language === 'he' ? 'עריכת כותרת נושא התקבלה' : language === 'ar' ? 'تم قبول تعديل عنوان الموضوع' : 'Topic title edit accepted';
  }
  if (d.includes('יצירת הצעה') || d.includes('created suggestion')) {
    return language === 'he' ? `יצירת הצעה חדשה` : language === 'ar' ? `تم إنشاء اقتراح: ${title}` : `Created suggestion: ${title}`;
  }
  if (d.includes('מענק הצטרפות') || d.includes('welcome bonus')) {
    return language === 'he' ? 'מענק הצטרפות' : language === 'ar' ? 'مكافأة الانضمام' : 'Welcome bonus';
  }

  return d;
};