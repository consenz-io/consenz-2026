# אפיון מערכת קבלת הצעות (Suggestion Acceptance System)

> מסמך זה מתעד את המצב הנוכחי של פיצ׳ר קבלת ההצעות כפי שהוא פועל בייצור, כולל התיקונים שבוצעו לאטומיות, נעילה אופטימית, ושחזור מכשלים.

---

## 1. מטרה והיקף

מערכת קבלת ההצעות אחראית לקבלה אוטומטית של הצעות קהילה כאשר הפער בין קולות "בעד" לקולות "נגד" מגיע לסף התמיכה של המסמך (`document.threshold`). הקבלה כוללת:

- **מוטציה של תוכן המסמך** — יצירת / עריכת / מחיקת סעיף, או עדכון תוכן הצעת אב.
- **יצירת רשומות גרסה** (`DocumentVersion`) — לשחזור היסטוריה ותצוגת diff.
- **עדכון מד הקונצנזוס והסף** — `document.consensuses` ו-`document.threshold`.
- **שליחת נוטיפיקציות** לכל המשתתפים במסמך.
- **חלוקת נקודות גיימיפיקציה** ליוצר ההצעה ולמצביעים המשפיעים (כאשר `gamificationEnabled`).

### עקרונות עיצוב

| עיקרון | תיאור |
|--------|-------|
| **אטומיות** | אין מצבים חלקיים — `status` עובר ל-`accepted` רק אחרי שכל תופעות הלוואי מצליחות. |
| **עמידות בתחרות** | אין קבלה כפולה מהצבעות מקבילות (נעילה אופטימית CAS). |
| **בר-שחזור** | כישלון לא חוסם הצעה לצמיתות — הנעילה משתחררת וההצעה נשארת retryable. |
| **Idempotent** | קריאה חוזרת על הצעה שכבר התקבלה לא יוצרת כפילויות. |

---

## 2. סוגי הצעות וזרימות קבלה

### 2.1 `new_section` — הצעת סעיף חדש

**תנאי קבלה:** `(proVotes - conVotes) >= document.threshold`

**פעולות ב-`processAcceptance`:**
1. אם אין `topicId` ויש `newTopicTitle` → יצירת `Topic` חדש (עם `newTopicOrder` או סוף הרשימה).
2. חישוב `newOrder` לסעיף: אם יש `insertPosition` → הזזת סעיפים קיימים (`order + 1`) + הזזת `insertPosition` של הצעות `new_section` pending אחרות באותו נושא; אחרת → סוף הרשימה.
3. יצירת `Section` עם `content = suggestion.newContent`, `originalLanguage` מזוהה אוטומטית.
4. יצירת `DocumentVersion` ראשונה (`changeType: section_created`, `version: 1`).
5. **קישור הצעות ילדות** (`edit_suggestion` pending עם `parentSuggestionId`) → המרה ל-`edit_section` + קישור ל-`sectionId` החדש + ניקוי `parentSuggestionId`.
6. **עדכון אטומי מיידי** של ה-`Suggestion`: `sectionId`, `status: accepted`, `originalContent: newContent`, `suggestionConsensus`, `participantsAtAcceptance`, `parentSuggestionId: null`. ה-`type` נשאר `new_section` כדי לזהות את ההצעה כיוצרת הסעיף (חשוב לירושת הצבעות ב-`voteOnSection`).

### 2.2 `edit_section` — עריכת סעיף קיים

**תנאי קבלה:** `(proVotes - conVotes) >= document.threshold`

**פעולות:**

**מקרה א — הסעיף קיים:**
1. שליפת ה-`Section` הנוכחי.
2. חישוב `nextVersion` מ-`DocumentVersion` האחרון.
3. במקביל: יצירת גרסת "לפני" (`content: section.content`, `changeType: suggestion_accepted`) + עדכון ה-`Section` (`content: newContent`, `lastEditedBy: voterId`, איפוס `translations`).
4. יצירת גרסת "אחרי" (`content: newContent`, `version: nextVersion + 1`).

**מקרה ב — הסעיף נמחק (Resurrection):**
> קורה כאשר הסעיף נמחק על ידי הקהילה או אדמין, אך ההצעה נשארה pending ומעוגנת למיקום המקורי (`topicId` + `originalSectionOrder`).

1. שליפת `topicId` מההצעה (נשמר בעת מחיקה).
2. חישוב `resurrectOrder` מ-`originalSectionOrder` או סוף הנושא.
3. יצירת `Section` חדש עם `content: newContent`.
4. יצירת `DocumentVersion` (`changeType: section_created`, `version: 1`).
5. עדכון ה-`Suggestion`: `sectionId: section.id`, `originalSectionOrder: null`.
6. **קישור הצעות ילדות** (`edit_suggestion` pending) → המרה ל-`edit_section` + קישור לסעיף המשוחזר.
7. **קישור הצעות יתומות אחרות** שעגנו לאותו סעיף שנמחק → קישור לסעיף המשוחזר + ניקוי `originalSectionOrder`.

### 2.3 `delete_section` — מחיקת סעיף

**תנאי קבלה:** `(proVotes - conVotes) >= document.threshold`

**פעולות ב-`processAcceptance`:**
1. שליפת ה-`Section`.
2. יצירת גרסת "לפני" (`content: section.content`, `changeType: suggestion_accepted`).
3. מחיקת ה-`Section`.
4. **עיגון הצעות יתומות** — `edit_section` / `delete_section` pending שכוונו לסעיף שנמחק → עדכון `topicId` + `originalSectionOrder: section.order` כדי שיישארו גלויות וברות-הצבעה במיקום המקורי. **אין דחייה** — הקהילה יכולה לקבל אותן ולשחזר את הסעיף.
5. יצירת גרסת "אחרי" ריקה (`content: ''`, `version: nextVersion + 1`) — מסמנת מחיקה לתצוגת diff.

### 2.4 `edit_suggestion` — עריכת הצעה אחרת

**תנאי קבלה:** `(proVotes - conVotes) >= document.threshold`

**פעולות ב-`processAcceptance`:**
1. שליפת הצעת האב (`parentSuggestionId`).
2. עדכון `newContent` של הצעת האב + איפוס `translations` + זיהוי שפה חדש.
3. **בדיקת סף האב (H3 guard):** אם האב עדיין `pending`:
   - אם `(parentProVotes - parentConVotes) >= document.threshold` → קריאה רקורסיבית ל-`processAcceptance` על האב עם `forceAccept: true`.
   - אחרת → **רק התוכן מתעדכן**, האב לא מתקבל אוטומטית (מונע מעקיפת סף האב דרך עריכת נוסח).

> **הערה:** `forceAccept: true` מדלג על בדיקת הסף בתחילת `processAcceptance`, אך האב עצמו כבר עבר את הסף — הדגל רק מונע בדיקה כפולה.

### 2.5 מחיקת סעיף בהצבעה ישירה (SectionVote)

> שונה מ-`delete_section` suggestion — זו הצבעה ישירה על סעיף קיים/מאושר דרך `SectionDeletionVoteBar`, לא דרך יצירת suggestion.

**תנאי מחיקה:** `(conCount - proCount) >= document.threshold` (כאשר "con" = תמיכה במחיקה)

**פעולות ב-`voteOnSection`:**
1. תיעוד / עדכון / מחיקת `SectionVote` (toggle / change / create).
2. ניקוי כפילויות (משתמש אחד = הצבעה אחת).
3. **ספירה מדודדופלת:** מתחיל מהצבעות שעברו בירושה מה-`Suggestion` שיצר את הסעיף (frozen at acceptance time — רק ה-`Suggestion` האחרון שהתקבל), ואז דריסה לפי `SectionVote` ישירות. כל משתמש נספר פעם אחת.
4. אם עבר את הסף:
   - יצירת `Suggestion` מסוג `delete_section` עם `status: accepted` (`proVotes: conCount`, `conVotes: proCount` — היפוך לתצוגה נכונה ב-`VotingProgressSection`).
   - **העברת תגובות סעיף** ל-`Suggestion` החדש (`rootEntityType: section → suggestion`).
   - יצירת שתי גרסאות (`changeType: section_deleted`: "לפני" עם תוכן + "אחרי" ריקה).
   - **עיגון הצעות יתומות** (כמו ב-`delete_section`).
   - מחיקת ה-`Section` + `SectionVote.deleteMany({ sectionId })`.
   - שליחת נוטיפיקציות `section_deleted` לכל המשתתפים (פרט למצביע שהפעיל).
5. החזרת `sectionDeleted: true` + `deleteSuggestionId`.

---

## 3. ארכיטקטורת Backend

### 3.1 פונקציות מרכזיות

| פונקציה | תפקיד | הרצה |
|---------|-------|------|
| `voteOnSuggestion` | תיעוד הצבעה + בדיקת סף → קריאה ל-`processAcceptance` | user context (auth) |
| `voteOnSection` | תיעוד הצבעת מחיקה + בדיקת סף → מחיקה ישירה | user context (auth) |
| `processAcceptance` | ביצוע הקבלה: מוטציה, גרסאות, נוטיפיקציות, נקודות | service-role (פנימי) |
| `awardSuggestionPoints` | HTTP endpoint להענקת נקודות (עוטף auth + idempotency) | user context |
| `awardSuggestionPointsLogic` | לוגיקת הענקת נקודות (shared module) | service-role (פנימי) |
| `expireSuggestions` | דחיית הצעות שפג תוקפן (cron) | scheduled |

### 3.2 שרשרת קבלה (Happy Path)

```
User clicks "Vote Pro"
    ↓
useVoteMutation.mutate('pro')  [frontend]
    ↓
base44.functions.invoke('voteOnSuggestion', { suggestionId, vote: 'pro' })
    ↓
voteOnSuggestion:
  1. Auth + rate limit (5 votes/min)
  2. Fetch allVotes + suggestion + document (parallel, service-role)
  3. Validate: status === 'pending', timer not expired
  4. Clean duplicate votes (keep one per user)
  5. Create/Update/Delete Vote (toggle/change/create)
  6. Re-read freshVotes from DB → update suggestion.proVotes/conVotes
  7. Update document.totalUsersInteracted (if new vote)
  8. Check: (proVotes - conVotes) >= threshold?
     ↓ YES
  9. Lock: processingAcceptance.add(lockKey)  [in-memory]
  10. base44.asServiceRole.functions.invoke('processAcceptance', {...})
     ↓
processAcceptance:
  1. Fetch suggestion + document (parallel)
  2. Pre-check: status === 'pending' (fast exit)
  3. Re-verify threshold (unless forceAccept)
  4. Stale lock recovery: if acceptanceLock && status pending && age > 2min → force-release
  5. Acquire lock: updateMany({ id, status: pending, acceptanceLock: false }, { $set: { acceptanceLock: true } })
  6. Verify ownership: retry/backoff loop (5 attempts × 150ms × attempt)
  7. Calculate contributors + consensus + new threshold (with deadlock guard)
  8. Mutate by type (edit_section / new_section / edit_suggestion / delete_section)
  9. Award gamification points (if gamificationEnabled)
  10. Update document (consensuses, threshold, totalUsersInteracted)
  11. Set suggestion.status = 'accepted' (ATOMIC — only here, at the end)
  12. Send notifications (bulkCreate to all participants)
     ↓
voteOnSuggestion (continued):
  11. Re-read suggestion from DB → verify status === 'accepted'
  12. Return { accepted: true, newProVotes, newConVotes, voteAction }
     ↓
useVoteMutation.onSuccess:
  - Update React Query cache (suggestions, documentAggregatedData)
  - toast.success('🎉 ההצעה התקבלה והמסמך עודכן!')
  - invalidateQueries(['documentAggregatedData'])  → refetch full state
  - dispatch 'consenz:vote-cast' + 'proposal:voted' events
```

---

## 4. אטומיות ונעילה אופטימית

### 4.1 הבעיה

ללא נעילה, שני משתמשים שמצביעים "בעד" בו-זמנית על אותה הצעה שעומדת בסף עלולים לגרום ל:
- יצירת שתי גרסאות כפולות.
- שליחת נוטיפיקציות כפולות.
- הענקת נקודות כפולות.

### 4.2 הפתרון — `acceptanceLock` (CAS)

**שדה:** `Suggestion.acceptanceLock` (boolean, default `false`)

**רכישה:**
```js
await base44.asServiceRole.entities.Suggestion.updateMany(
  { id: suggestionId, status: 'pending', acceptanceLock: false },
  { $set: { acceptanceLock: true } }
);
```

**אימות בעלות (retry/backoff):**
```js
let weOwnLock = false;
for (let attempt = 0; attempt < 5; attempt++) {
  const check = await base44.asServiceRole.entities.Suggestion.get(suggestionId);
  if (check?.status === 'pending' && check?.acceptanceLock === true) {
    weOwnLock = true;
    break;
  }
  if (check?.status !== 'pending') break; // someone else finished
  await new Promise(r => setTimeout(r, 150 * (attempt + 1)));
}
```

> **למה retry ולא קריאה אחת?** Read-after-write lag עלול להחזיר ערך pre-write מיד אחרי כתיבה מוצלחת. הלולאה נותנת זמן לכתיבה להתפשט.

### 4.3 שחזור Stale Lock

אם `processAcceptance` קודם timeout/crash אחרי רכישת הנעילה, `acceptanceLock` נשאר `true` עם `status: pending` — ההצעה תקועה לצמיתות.

**זיהוי:**
```js
const lockAgeMs = Date.now() - new Date(lockCheck.updated_date).getTime();
if (lockAgeMs > 120000) { // 2 minutes
  await base44.asServiceRole.entities.Suggestion.update(suggestionId, { acceptanceLock: false });
}
```

### 4.4 שחרור נעילה בכישלון

```js
catch (error) {
  if (lockAcquired && base44 && suggestionId) {
    await base44.asServiceRole.entities.Suggestion.updateMany(
      { id: suggestionId, status: 'pending', acceptanceLock: true },
      { $set: { acceptanceLock: false } }
    );
  }
  return Response.json({ error: error.message }, { status: 500 });
}
```

> **שומר על `status: pending` בפילטר** — אם instance מקביל כבר סיים בהצלחה (`status: accepted`), השחרור לא ידרוס אותו.

### 4.5 אטומיות סטטוס (התיקון הקריטי)

**לפני התיקון:** `status` הוגדר ל-`accepted` בתחילת `processAcceptance`. כישלון אמצע השאיר את ההצעה במצב חצי-מתקבל (`status: accepted` ללא גרסה/נוטיפיקציה), וה-catch block לא יכול היה לשחזר כי סינן לפי `status: pending`.

**אחרי התיקון:** `status` עובר ל-`accepted` **רק בסוף**, אחרי שכל תופעות הלוואי מצליחות. אם משהו נכשל — ה-catch block משחרר את הנעילה (כי `status` עדיין `pending`) וההצעה נשארת retryable.

---

## 5. מד הקונצנזוס וחישוב סף

### 5.1 נוסחת קונצנזוס לסעיף

```
sectionConsensus = (delta + totalUsers) / (2 * totalUsers)
```

כאשר:
- `delta = proVotes - conVotes`
- `totalUsers` = מספר המשתתפים הייחודיים במסמך (מצביעים, מגיבים, יוצרי הצעות, חותמי הסכמה)

**תוצאה:** ערך בין 0 ל-1, מתחשב במספר המשתתפים ולא רק ביחס המצביעים.

### 5.2 עדכון מד המסמך

```js
const updatedConsensuses = [...(document.consensuses || []), boundedConsensus];
const consensusMeterAverage = updatedConsensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / updatedConsensuses.length;
```

### 5.3 חישוב סף חדש + Deadlock Guard

```js
const rawThreshold = Math.max(2, Math.round(consensusMeterAverage * totalUsers));
const cap = activeVoterCount > 0 ? Math.max(2, activeVoterCount) : rawThreshold;
const newThreshold = Math.min(rawThreshold, cap);
```

**`activeVoterCount`** = מספר המצביעים הפעילים הייחודיים (מצביעים על הצעות + מצביעים על סעיפים).

**למה cap?** ללא הגבלה, מסמך עם הסטוריה ארוכה ומד קונצנזוס גבוה עלול לייצר סף שעולה על מספר המצביעים הפעילים — כל הצעה עתידית תיכשל ("מסמך קפוא").

### 5.4 חישוב `totalUsers` (Contributors)

משתמשים ייחודיים מתוך:
- `Vote.userId` (הצבעות על הצעות)
- `SectionVote.userId` (הצבעות על סעיפים)
- `Comment.created_by_id` (תגובות)
- `DocumentAgreement.userId` (חתימות)
- `Suggestion.created_by_id` (יוצרי הצעות)

> **אופטימיזציה:** כל השליפות scoped ל-`documentId` — אין `list()` גלובלי.

---

## 6. גיימיפיקציה

### 6.1 תנאי הפעלה

`document.gamificationEnabled === true`

### 6.2 חלוקת נקודות (`awardSuggestionPointsLogic`)

| נמען | סכום | פעולה (`action`) |
|------|------|------------------|
| יוצר ההצעה | +500 | `suggestion_accepted` |
| כל מצביע "בעד" (פרט ליוצר) | +50 | `vote_influenced_acceptance` |
| יוצר עריכת כותרת נושא | +100 | `topic_edit_accepted` |

### 6.3 Idempotency

```js
const existingTx = await base44.entities.PointsTransaction.filter({
  relatedEntityId: suggestionId,
  userId: creatorId,
  action
});
if (existingTx.length > 0) return { success: true, skipped: true };
```

> כל משתמש נבדק בנפרד — אם נקודות כבר הוענקו ליוצר, עדיין נבדקים המצביעים.

### 6.4 נקודות על יצירת הצעה

מוענקות ב-`handleNewSuggestion` (לא בקבלה) — לא בהיקף מסמך זה.

---

## 7. נוטיפיקציות

### 7.1 סוגי נוטיפיקציות קבלה

| סוג | נמען | תוכן |
|-----|------|-----|
| `suggestion_accepted` | יוצר ההצעה | "🎉 ההצעה שלך התקבלה!" + קישור למסמך |
| `suggestion_accepted` | שאר משתתפים | "הצעה התקבלה במסמך" + קישור ל-`suggestiondetail` |
| `section_deleted` | כל משתתפים (פרט למצביע) | "סעיף הוסר מהמסמך" + קישור ל-`suggestiondetail` של ה-`delete_suggestion` |

### 7.2 ריבוי שפות

כל נוטיפיקציה נשלחת עם `translations` (`{en, he, ar}`) + `title`/`message` בשפת המשתמש המועדפת (`user.preferredLanguage`).

### 7.3 שליחה

```js
await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
```

> כישלון שליחה לא נוקטע את הקבלה — נתפס ב-`try/catch` ונרשם בלוג.

---

## 8. פרונטאנד

### 8.1 `useVoteMutation` (הצבעה על הצעה)

**Optimistic Update (`onMutate`):**
- ביטול queries ב-flight (`suggestions`, `userVotes`, `documentAggregatedData`).
- עדכון מקומי של `proVotes`/`conVotes` + הצבעת המשתמש ב-3 caches.
- שמירת `previousSuggestions`/`previousVotes`/`previousAggregated` ל-rollback.

**הצבעה (`mutationFn`):**
- מנעות כפילויות (`votingInProgressRef`).
- קריאה יחידה ל-`voteOnSuggestion`.
- החזרת `{ accepted, newProVotes, newConVotes, voteAction }`.

**הצלחה (`onSuccess`):**
- עדכון cache מתגובת שרת מאומתת.
- אם `accepted: true` → `toast.success` + `invalidateQueries(['documentAggregatedData'])`.
- dispatch `consenz:vote-cast` (עדכון counter) + `proposal:voted` (tutorial).

**כישלון (`onError`):**
- Rollback ל-3 caches.
- זיהוי "not a member" → פתיחת דיאלוג הצטרפות.
- זיהוי rate limit → toast ייעודי.
- `invalidateQueries` לתיקון סטייה.

### 8.2 `VotingProgressSection`

- תצוגת progress bar + כפתורי הצבעה.
- `effectiveReadOnly` = `isClosed` (status !== pending) **או** `isTimerExpired` — לא מבוסס על auth בלבד.
- סף מוקפא ל-`delta` בעת `accepted` (כי `delta >= threshold` בדיוק).
- סימולציית hover: מציג איזה progress יהיה אחרי הצבעת pro/con.
- תצוגת `delete_section`: היפוך pro/con ("pro" = תומכי מחיקה, "con" = שומרי הסעיף).
- תצוגת admin-accepted: badge נפרד ("אושרה על ידי מנהל").

### 8.3 `SectionDeletionVoteBar`

- הצבעה על סעיףים קיימים/מאושרים ("pro" = שמור, "con" = מחק).
- **ספירה מדודדופלת** בין הצבעות ירושה (`sourceSuggestion.voters`) והצבעות ישירות.
- דיאלוג "הצבע נגד": 3 אפשרויות — (1) הצבעה נגד בלבד, (2) הסבר כתגובה, (3) הצעת נוסח חלופי (מעבר ל-`CreateSuggestionModal`).
- אנימציית flash אדומה (`section-deleted-flash` event) + הפניה ל-`suggestiondetail` של ה-`delete_suggestion`.

### 8.4 `suggestionAutoAccept.jsx` (Legacy / Frontend)

> **אזהרה:** קובץ זה מכיל לוגיקת קבלה בצד לקוח. **היום הקבלה מבוצעת אך ורק ב-`processAcceptance` (backend).** הקובץ נשמר לתאימות לאחור / fallback, אך אינו נתיב הקבלה הראשי. יש להימנע מהסתמכות עליו.

---

## 9. מודל נתונים (שדות רלוונטיים)

### `Suggestion`

| שדה | תיאור |
|-----|-------|
| `status` | `pending` / `accepted` / `rejected` / `discussion` |
| `acceptanceLock` | boolean — נעילה אופטימית למניעת קבלה כפולה |
| `proVotes` / `conVotes` | מספרים — מתעדכנים מספירת DB אמיתית |
| `suggestionConsensus` | ערך 0-1 — נשמר בעת קבלה |
| `participantsAtAcceptance` | מספר משתתפים בעת קבלה |
| `sectionId` | סעיף מטרה (ל-`edit_section`/`delete_section`) או סעיף שנוצר (ל-`new_section`) |
| `topicId` | נושא מטרה או נושא מקור (ל-`delete_section` של סעיף שנמחק) |
| `originalSectionOrder` | מיקום מקורי של סעיף שנמחק — לעיגון הצעות יתומות |
| `parentSuggestionId` | הצעת אב (ל-`edit_suggestion`) |
| `approvedByAdmin` | true אם אושר על ידי אדמין (לא על ידי סף) — לא נכנס למד הקונצנזוס |
| `timerEndsAt` | תום תקופת הצבעה |

### `Document`

| שדה | תיאור |
|-----|-------|
| `threshold` | סף תמיכה נוכחי (מתעדכן רק בעת קבלה) |
| `consensuses` | מערך ערכי קונצנזוס של הצעות שהתקבלו |
| `totalUsersInteracted` | מספר משתתפים ייחודיים |
| `gamificationEnabled` | boolean — הפעלת מערכת נקודות |
| `defaultSuggestionLifetimeHours` | תקופת הצבעה (ברירת מחדל 72 שעות) |

### `DocumentVersion`

| שדה | תיאור |
|-----|-------|
| `changeType` | `suggestion_accepted` / `section_created` / `section_deleted` / `direct_edit` |
| `content` | תוכן הסעיף בגרסה זו (ריק = נמחק) |
| `version` | מספר גרסה עולה |
| `suggestionId` | הצעה שיצרה את הגרסה |
| `topicId` / `sectionOrder` | לשחזור סעיפים שנמחקו |

### `Vote` / `SectionVote`

| שדה | תיאור |
|-----|-------|
| `suggestionId` / `sectionId` | ישות מטרה |
| `userId` | מצביע |
| `vote` | `pro` / `con` |

> **אכיפת ייחודיות:** אין unique constraint ברמת DB. הניקוי מתבצע ב-`voteOnSuggestion`/`voteOnSection` (שמירת הצבעה אחת למשתמש, מחיקת כפילויות).

### `PointsTransaction`

| שדה | תיאור |
|-----|-------|
| `userId` | מקבל הנקודות |
| `amount` | שינוי (חיובי/שלילי) |
| `action` | `suggestion_accepted` / `vote_influenced_acceptance` / `topic_edit_accepted` / ... |
| `relatedEntityId` | הצעה/הצבעה/תגובה קשורה |
| `relatedEntityType` | `suggestion` / `vote` / `topic` / `comment` |

---

## 10. מקרי קצה וטיפול

| מקרה | טיפול |
|-----|-------|
| הצבעה מקבילה על אותה הצעה בסף | נעילה אופטימית — משתמש אחד מקבל, השני מקבל "Already being processed" |
| `processAcceptance` timeout | Stale lock recovery (2 דקות) — הקבלה הבאה משחררת ומנסה מחדש |
| הצבעה על הצעה שפג תוקפה | נחסמת ב-`voteOnSuggestion` (גם אם ה-cron עדיין לא רץ) |
| הצעה לסעיף שנמחק | עוגנת ל-`topicId` + `originalSectionOrder`, נשארת גלויה וברת-הצבעה; קבלתה משחזרת את הסעיף |
| `edit_suggestion` להצעת אב שלא עומדת בסף | רק תוכן האב מתעדכן — האב לא מתקבל אוטומטית (H3 guard) |
| סף עולה על מספר מצביעים פעילים | Deadlock guard — `threshold = min(rawThreshold, activeVoterCount)` |
| כפילות הצבעות למשתמש | ניקוי ב-`voteOnSuggestion`/`voteOnSection` (שמירת אחת, מחיקת השאר) |
| כישלון שליחת נוטיפיקציה | נתפס ב-`try/catch`, לא נוקטע — הקבלה מצליחה |
| כישלון הענקת נקודות | נתפס ב-`try/catch`, לא נוקטע — הקבלה מצליחה |
| קבלה כפולה (קריאה חוזרת) | Idempotent — רכישת נעילה נכשלת (`status !== pending`), חוזר מוקדם |
| תגובות על סעיף שנמחק | מועברות ל-`delete_suggestion` (`rootEntityType: section → suggestion`) |

---

## 11. נקודות ציון ובעיות ידועות

### תיקונים שבוצעו

1. **אטומיות סטטוס** — `status` עובר ל-`accepted` רק בסוף `processAcceptance`.
2. **שחזור stale lock** — זיהוי דרך `updated_date` (2 דקות) + שחרור בכוח.
3. **שחרור נעילה בכישלון** — guarded על ידי `status: pending` בפילטר.
4. **אימות פרונטאנד** — `voteOnSuggestion` מבצע re-read מ-DB, לא סומך על תגובת mutation.
5. **Deadlock guard** — `threshold` לא עולה על `activeVoterCount`.
6. **ספירה מדודדופלת** — מונעת double-counting בין הצבעות ירושה וישירות.
7. **עיגון הצעות יתומות** — לא נדחות, נשארות גלויות וברות-הצבעה.
8. **H3 guard** — `edit_suggestion` לא מקבל את האב אוטומטית.

### בעיות ידועות (לא בהיקף מסמך זה)

- הצעות עם `acceptanceLock: true` תקועות (נוקו ידנית, אך הגורם השורשי עשוי לחזור אם timeout קצר מ-2 דקות).
- טוסט קבלה לעיתים לא מופיע למרות שהלוגיקה רצה (במעקב).
- `suggestionAutoAccept.jsx` (legacy) עדיין בריפו — יש להסיר/לסמן כ-deprecated.

---

## 12. קבצים רלוונטיים

### Backend

| קובץ | תפקיד |
|------|-------|
| `base44/functions/voteOnSuggestion/entry.ts` | תיעוד הצבעה + הפעלת קבלה |
| `base44/functions/voteOnSection/entry.ts` | תיעוד הצבעת מחיקה + מחיקה ישירה |
| `base44/functions/processAcceptance/entry.ts` | לוגיקת קבלה מרכזית |
| `base44/functions/awardSuggestionPoints/entry.ts` | HTTP endpoint להענקת נקודות |
| `base44/shared/awardSuggestionPointsLogic.ts` | לוגיקת הענקת נקודות (shared) |
| `base44/functions/expireSuggestions/entry.ts` | דחיית הצעות שפג תוקפן (cron) |

### Frontend

| קובץ | תפקיד |
|------|-------|
| `src/components/document/hooks/useVoteMutation.jsx` | mutation הצבעה + optimistic updates |
| `src/components/document/VotingProgressSection.jsx` | תצוגת progress bar + כפתורי הצבעה |
| `src/components/document/SectionDeletionVoteBar.jsx` | תצוגת הצבעת מחיקת סעיף |
| `src/components/document/suggestionAutoAccept.jsx` | legacy — לוגיקת קבלה בצד לקוח (deprecated) |
| `src/components/document/hooks/useDocumentSubscriptions.jsx` | realtime subscriptions לעדכונים |
| `src/components/document/hooks/useOptimisticMutations.jsx` | optimistic mutations משניות |

---

*מסמך זה משקף את מצב המערכת נכון לספטמבר 2026. יש לעדכן אותו בכל שינוי מהותי בלוגיקת הקבלה.*