# שכתוב מערכת התרגום השיתופית — מסמך תכנון

## מטרה
משתמשים דוברי עברית, ערבית ואנגלית עורכים יחד מסמך אחד. לכל גרסה של סעיף — נוכחית, קודמת, או נוסח של הצעה — יש תרגום קבוע ומשותף לכל המשתמשים. שני משתמשים באותה שפה רואים אותו נוסח תרגום ויכולים לבסס עליו הצעות עריכה עקביות.

---

## מיפוי המערכת הקיימת

### נקודות התרגום הפעילות כיום

| רכיב | מיקום | מצב |
|------|-------|-----|
| `translateContent` (פונקציית שרת) | `base44/functions/translateContent/entry.ts` | פעיל — מתרגם טקסט/HTML לפי בקשה, לא מנהל מטמון |
| `translateDocumentAll` (פונקציית שרת) | `base44/functions/translateDocumentAll/entry.ts` | פעיל — מתרגם מסמך שלם, שומר לשדה `translations` בכל ישות |
| `TranslatableContent` (רכיב תצוגה) | `src/components/document/TranslatableContent.jsx` | פעיל — קורא `translateContent`, שומר תרגום ל-`entity.translations[lang]` |
| `translationService` (שירות צד לקוח) | `src/components/document/translationService.jsx` | **מנוטרל** — כל הפונקציות זורקות שגיאה |
| `SmartDiffTranslationService` | `src/components/document/SmartDiffTranslationService.jsx` | **מנוטרל** — כל הפונקציות זורקות שגיאה |
| `TranslateAllButton` | `src/components/document/TranslateAllButton.jsx` | **מנוטרל** — מחזיר `null` |
| `TranslationContext` | `src/components/document/TranslationContext.jsx` | פעיל אך לא מנוהל גרסאות |

### בעיות היסוד שזוהו

1. **אין זהות גרסה.** התרגום נשמר ב-`entity.translations[lang]` לפי מזהה הישות בלבד. כשסעיף משתנה, התרגום הישן מוחלף בשקט או נשאר תלוי במצב הנוכחי — אין קישור לגרסה המדויקת שתורגמה.

2. **תרגום אינו משותף.** `TranslatableContent` קורא `translateContent` ושומר את התוצאה ל-`entity.translations` מהצד לקוח. שני משתמשים שמתרגמים את אותו תוכן יכולים לקבל נוסחים שונים, והאחרון ששומר מנצח.

3. **אין מניעת כפילות.** בקשות מקבילות לאותו תוכן ושפה יוצרות תרגומים מתחרים.

4. **הצעות אינן גרסה.** הצעה מכילה `newContent` ו-`originalContent` אך אין להן זהות גרסה יציבה שמאפשרת לקשר תרגום אליהן באופן קנוני.

5. **שירותי הצד לקוח מנוטרלים.** `translationService` ו-`SmartDiffTranslationService` זורקים שגיאות — המערכת תלויה כיום ב-`TranslatableContent` בלבד.

---

## זהות גרסה — הגדרה

כל יחידת תוכן שניתנת לתרגום מקבלת **מזהה גרסה יציב**. סוגי יחידות:

| סוג יחידה | מקור התוכן | מזהה גרסה |
|-----------|-----------|-----------|
| סעיף נוכחי | `Section.content` | `section:{sectionId}:current` |
| גרסה קודמת | `DocumentVersion.content` | `version:{versionId}` |
| נוסח מקורי בהצעה | `Suggestion.originalContent` | `suggestion:{suggestionId}:original` |
| נוסח מוצע בהצעה | `Suggestion.newContent` | `suggestion:{suggestionId}:proposed` |
| כותרת מסמך | `Document.title` | `document:{documentId}:title` |
| תיאור מסמך | `Document.description` | `document:{documentId}:description` |
| כותרת נושא | `Topic.title` | `topic:{topicId}:title` |
| תגובה | `Comment.content` | `comment:{commentId}:content` |

**כלל המפתח:** מזהה הגרסה אינו תלוי בשפת הצפייה של המשתמש. הוא מזהה את הנוסח המקורי בלבד.

---

## חוזה נתונים — ישות `Translation`

תרגומים יישמרו בישות ייעודית, לא בשדה `translations` המוטבע בכל ישות. כך מובטחת יחידות, שיתוף, ומניעת כפילות.

### מפתח קנוני
```
(sourceEntityType, sourceEntityId, sourceVersionId, targetLanguage)
```
לכל צירוף כזה קיים **תרגום קנוני אחד** בלבד, משותף לכל המשתמשים.

### חוזה
```
Translation {
  documentId:        string   // לבדיקת הרשאה ולמחיקה בטוחה
  sourceEntityType:  enum     // section | version | suggestion | document | topic | comment
  sourceEntityId:    string   // מזהה הישות המקורית
  sourceVersionId:   string   // מזהה הגרסה היציב (לפי הטבלה לעיל)
  sourceLanguage:    enum     // en | he | ar — שפת המקור
  targetLanguage:    enum     // en | he | ar — שפת היעד
  sourceContentHash: string   // גיבוב קצר של תוכן המקור, לאימות שהמקור לא השתנה
  translatedContent: string   // הטקסט המתורגם
  status:            enum     // ready | failed | stale
  translatedAt:      datetime // מועד היצירה
  translatedBy:      string   // מזהה המשתמש שיזם (לצורך מעקב בלבד)
}
```

### כללי שמירה
- **יצירה:** אם קיים תרגום לאותו מפתח קנוני ו-`status: ready`, מחזירים אותו. לא מתרגמים שוב.
- **גרסה חדשה:** כשהצעה מתקבלת ונוצרת גרסה חדשה, נוצר `sourceVersionId` חדש. תרגומי הגרסאות הקודמות נשארים ללא שינוי.
- **שינוי מקור:** אם `sourceContentHash` אינו תואם את תוכן המקור הנוכחי, התרגום מסומן `stale` ולא מוצג כתרגום קנוני. המערכת יוצרת תרגום חדש לגרסה החדשה.
- **מחיקה:** ניתן למחוק תרגומים של מסמך שלם לפי `documentId`, אך לא לעדכן אותם בשקט.

---

## הצעות עריכה רב-לשוניות

### מבנה הצעה
הצעה שומרת:
- `createdByLanguage` — שפת הכתיבה של המציע (כבר קיים).
- `sourceVersionId` — גרסת הבסיס שעליה מתבססת ההצעה (חדש). מצביע על `section:{sectionId}:current` בעת היצירה, או על `version:{versionId}` אם המשתמש ערך מתוך גרסה קודמת.
- `newContent` — הנוסח המוצע, בשפת המציע.
- `originalContent` — נוסח המקור בעת היצירה (קיים).

### תרגום הצעה
- הנוסח המוצע (`newContent`) מתורגם לפי `suggestion:{suggestionId}:proposed`.
- הנוסח המקורי (`originalContent`) מתורגם לפי `suggestion:{suggestionId}:original`.
- שני התרגומים קנוניים ומשותפים.

### הצעה שמבוססת על גרסה שהשתנתה
אם גרסת הבסיס של ההצעה כבר אינה הנוכחית (הסעיף השתנה מאז):
- ההצעה נשארת מקושרת ל-`sourceVersionId` המקורי.
- הממשק מציג במפורש שההצעה מבוססת על גרסה קודמת.
- ההצעה אינה מועברת אוטומטית לגרסה החדשה.
- הצבעה וקבלה ממשיכים לפעול על הנתונים המקוריים בלבד.

---

## שירות התרגום המרכזי

פונקציית שרת אחת, `translateVersion`, מחליפה את `translateContent` ו-`translateDocumentAll`:

### קלט
```
{
  documentId,
  sourceEntityType,
  sourceEntityId,
  sourceVersionId,
  sourceLanguage,
  targetLanguage,
  content,          // תוכן המקור לתרגום
  isHtml
}
```

### לוגיקה
1. בדיקת הרשאה למסמך (`checkDocumentAuthorization`).
2. חישוב `sourceContentHash` מהתוכן שהתקבל.
3. חיפוש תרגום קיים לפי המפתח הקנוני.
4. אם קיים ו-`status: ready` ו-`sourceContentHash` תואם — החזרתו.
5. אחרת — תרגום ב-LLM, אימות פלט, שמירה לישות `Translation`, החזרה.

### תרגום מסמך שלם
פונקציה נפרדת, `translateDocumentVersions`, מקבלת `documentId` ו-`targetLanguage`, מאספת את כל יחידות התוכן הנוכחיות, בונה את מזהי הגרסאות, וקוראת ל-`translateVersion` עבור כל אחת. תוצאה מפורטטת לכל פריט.

---

## מיגרציה של נתונים ישנים

שדות `translations` הישנים בישויות (Section, Suggestion, DocumentVersion, Topic, Document, Comment) **לא יימחקו** בשלב זה.

| מצב נתון ישן | פעולה |
|--------------|-------|
| תרגום ב-`entity.translations[lang]` שניתן לזהות את גרסת המקור שלו | מיגרציה לישות `Translation` עם `sourceVersionId` מתאים, `status: ready` |
| תרגום שלא ניתן לזהות את גרסת המקור בוודאות | השארה בשדה הישן, לא מיגרציה. המערכת החדשה מתעלמת ממנו עד לאימות ידני. |
| תרגום שגוי/מיושן | השארה בשדה הישן. המערכת החדשה תיצור תרגום חדש במקומו. |

סקריפט מיגרציה ירוץ פעם אחת, יסמן כל רשומה שמוגרה, וישאיר את השדות הישנים למחיקה ידנית לאחר אימות.

---

## שלבי הביצוע הבאים

1. ✅ **שלב 1 — מיפוי וחוזה** (מסמך זה)
2. **שלב 2 — ישות `Translation` ושירות `translateVersion`**
3. **שלב 3 — שילוב במסך המסמך (סעיף נוכחי + כותרות)**
4. **שלב 4 — תרגום גרסאות קודמות והצעות**
5. **שלב 5 — תרגום מסמך שלם עם דיווח מפורט**
6. **שלב 6 — מיגרציה וניקוי נתונים ישנים**