import { base44 } from "@/api/base44Client";

/**
 * הוספת התראה למערכת Email Digest
 * מוסיף התראה לטבלה שתישלח במייל יומי/שבועי
 */
export async function addToEmailDigest({
  userId,
  notificationType,
  title,
  message,
  actionUrl,
  relatedEntityType,
  relatedEntityId,
  documentId,
  documentTitle
}) {
  try {
    // בדוק אם המשתמש רוצה לקבל התראות מייל
    const userList = await base44.entities.User.filter({ id: userId });
    if (!userList || userList.length === 0) {
      console.log('[EMAIL DIGEST] User not found:', userId);
      return;
    }
    
    const user = userList[0];
    
    // אם המשתמש בחר none - לא שולחים מיילים
    if (user.emailDigestFrequency === 'none') {
      console.log('[EMAIL DIGEST] User opted out of email digests:', userId);
      return;
    }
    
    // בדוק אם סוג ההתראה כלול ברשימה שלו
    const digestTypes = user.emailDigestTypes || [];
    if (digestTypes.length > 0 && !digestTypes.includes(notificationType)) {
      console.log('[EMAIL DIGEST] User does not want this notification type:', notificationType);
      return;
    }
    
    // צור רשומה חדשה ב-EmailDigest
    await base44.entities.EmailDigest.create({
      userId,
      notificationType,
      title,
      message,
      actionUrl,
      relatedEntityType,
      relatedEntityId,
      documentId,
      documentTitle,
      isIncludedInDigest: false
    });
    
    console.log('[EMAIL DIGEST] Added notification for user:', userId, 'type:', notificationType);
  } catch (error) {
    console.error('[EMAIL DIGEST ERROR]', error);
    // לא זורקים שגיאה - לא נרצה לקרוס את כל התהליך אם מייל נכשל
  }
}