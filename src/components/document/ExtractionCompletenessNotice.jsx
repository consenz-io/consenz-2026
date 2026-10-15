import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle } from 'lucide-react';

export default function ExtractionCompletenessNotice({ report, language, onReset }) {
  if (!report) return null;
  const copy = {
    he: ['לא זוהה תוכן חסר בבדיקה מול הקובץ המקורי.', 'זוהה תוכן חסר. יצירת המסמך חסומה; יש להעלות שוב את הקובץ לבדיקה.', 'לא ניתן לאשר את שלמות החילוץ. יצירת המסמך חסומה עד לבדיקה מוצלחת.', 'עמוד', 'ניקוי ההעלאה והתחלה מחדש', 'מוצגים חלק מהממצאים בלבד.', 'הבדיקה מבוססת AI ואינה מבטיחה זיהוי של כל השמטה.'],
    ar: ['لم يُكتشف محتوى مفقود بالمقارنة مع الملف الأصلي.', 'اكتُشف محتوى مفقود. إنشاء المستند محظور؛ أعد رفع الملف للتحقق.', 'تعذر تأكيد اكتمال الاستخراج. إنشاء المستند محظور حتى نجاح التحقق.', 'صفحة', 'مسح الرفع والبدء من جديد', 'تُعرض بعض النتائج فقط.', 'الفحص يعتمد على الذكاء الاصطناعي ولا يضمن اكتشاف جميع الأجزاء المفقودة.'],
    en: ['No missing content detected against the original file.', 'Missing content detected. Creation is blocked; upload the file again for verification.', 'Completeness could not be confirmed. Creation is blocked until verification succeeds.', 'Page', 'Clear upload and start again', 'Only some findings are shown.', 'This AI-based check does not guarantee detection of every omission.']
  }[language] || ['No missing content detected.', 'Missing content detected. Creation is blocked.', 'Verification unavailable. Creation is blocked.', 'Page', 'Clear upload and start again', 'More findings exist.', 'AI verification may miss omissions.'];
  const passed = report.status === 'passed';
  const Icon = passed ? CheckCircle : AlertCircle;
  return (
    <Alert variant={passed ? 'default' : 'destructive'} dir={language === 'en' ? 'ltr' : 'rtl'}>
      <Icon className="h-4 w-4" />
      <AlertDescription className="space-y-3">
        <p>{copy[passed ? 0 : report.status === 'missing' ? 1 : 2]}</p>
        {!!report.findings?.length && <ul className="list-disc list-inside space-y-2">{report.findings.map((finding, index) => <li key={index} dir="auto">{copy[3]} {finding.page}: {finding.excerpt}</li>)}</ul>}
        {report.pages?.filter(page => page.status !== 'complete').map(page => <p key={page.page} dir="auto">{copy[3]} {page.page}: {page.detail}</p>)}
        {report.hasMoreFindings && <p>{copy[5]}</p>}
        <p className="text-sm">{copy[6]}</p>
        {!passed && <Button type="button" variant="outline" onClick={onReset}>{copy[4]}</Button>}
      </AlertDescription>
    </Alert>
  );
}