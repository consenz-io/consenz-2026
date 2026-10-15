import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Label } from '@/components/ui/label';

const modules = { toolbar: [['bold', 'italic', 'underline'], ['link'], [{ list: 'ordered' }, { list: 'bullet' }], ['clean']] };

export default function DocumentDescriptionEditor({ value, onChange, language }) {
  const label = language === 'he' ? 'תיאור המסמך' : language === 'ar' ? 'وصف المستند' : 'Document description';
  const hint = language === 'he'
    ? 'רקע והסבר על המסמך, שיופיעו מעל הסעיפים. בהעלאת קובץ, טקסט מתאים יזוהה ויוצע כאן לעריכה.'
    : language === 'ar'
      ? 'خلفية وشرح للمستند يظهران فوق البنود. عند رفع ملف، يُستخرج النص المناسب هنا للمراجعة والتحرير.'
      : 'Background and context shown above the document sections. When uploading a file, suitable text is extracted here for review and editing.';
  return (
    <div className="space-y-2">
      <Label htmlFor="document-description">{label}</Label>
      <div dir="auto" className="rounded-md bg-background text-foreground [&_.ql-editor]:min-h-32 [&_.ql-editor]:text-start">
        <ReactQuill id="document-description" theme="snow" value={value} onChange={onChange} modules={modules} />
      </div>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}