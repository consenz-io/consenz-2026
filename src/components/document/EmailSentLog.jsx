import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Eye, MousePointerClick, Users, CheckCircle, XCircle, TestTube } from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/components/LanguageContext";

function StatPill({ icon: Icon, label, value, color }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      <span>{label}: <strong>{value}</strong></span>
    </div>
  );
}

const EMAIL_LOG_LABELS = {
  he: {
    title: 'יומן שליחת סיכומים במייל',
    desc: 'מעקב אחר כל המיילים שנשלחו למשתתפי המסמך',
    noLogs: 'עדיין לא נשלחו מיילים למסמך זה',
    sent: 'נשלח', failed: 'נכשל', opens: 'פתיחות', clicks: 'קליקים',
    recipients: 'נמענים', test: 'טסט', summary: 'סיכום',
  },
  ar: {
    title: 'سجل إرسال الملخصات بالبريد',
    desc: 'تتبع جميع رسائل البريد المرسلة إلى المشاركين',
    noLogs: 'لم يتم إرسال أي رسائل بريد إلكتروني لهذا المستند بعد',
    sent: 'مُرسل', failed: 'فاشل', opens: 'فتحات', clicks: 'نقرات',
    recipients: 'مستلمون', test: 'اختبار', summary: 'ملخص',
  },
  en: {
    title: 'Email Summary Log',
    desc: 'Track all emails sent to document participants',
    noLogs: 'No emails have been sent for this document yet',
    sent: 'Sent', failed: 'Failed', opens: 'Opens', clicks: 'Clicks',
    recipients: 'Recipients', test: 'Test', summary: 'Summary',
  },
};

export default function EmailSentLog({ documentId }) {
  const { language } = useLanguage();
  const isRTL = language === 'he' || language === 'ar';

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['emailLogs', documentId],
    queryFn: () => base44.entities.EmailLog.filter(
      { relatedEntityId: documentId, relatedEntityType: 'document' },
      '-created_date',
      100
    ),
    staleTime: 2 * 60 * 1000,
  });

  // Group by batchId (or by created_date minute as fallback), sorted newest first
  const batches = useMemo(() => {
    const batchMap = new Map();
    logs.forEach(log => {
      const key = log.batchId || log.created_date?.slice(0, 16) || log.id;
      if (!batchMap.has(key)) {
        batchMap.set(key, {
          batchId: key,
          subject: log.subject,
          sentAt: log.created_date,
          senderEmail: log.senderEmail,
          isTestEmail: log.isTestEmail,
          purpose: log.purpose,
          recipients: [],
          totalSent: 0,
          totalFailed: 0,
          totalOpens: 0,
          totalClicks: 0,
        });
      }
      const batch = batchMap.get(key);
      batch.recipients.push(log.recipientEmail);
      if (log.status === 'sent') batch.totalSent++;
      else batch.totalFailed++;
      batch.totalOpens += log.openCount || 0;
      batch.totalClicks += log.clickCount || 0;
    });
    return [...batchMap.values()].sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
  }, [logs]);

  const l = EMAIL_LOG_LABELS[language] || EMAIL_LOG_LABELS.en;

  if (isLoading) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />{l.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-indigo-600" />
          {l.title}
        </CardTitle>
        <CardDescription>{l.desc}</CardDescription>
      </CardHeader>
      <CardContent>
        {batches.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{l.noLogs}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {batches.map(batch => (
              <div
                key={batch.batchId}
                className="border border-slate-200 rounded-xl p-4 hover:bg-slate-50 transition-colors"
                dir={isRTL ? 'rtl' : 'ltr'}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{batch.subject}</p>
                      {batch.isTestEmail && (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                          <TestTube className="w-3 h-3 mr-1" />{l.test}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      {batch.senderEmail} · {batch.sentAt ? format(new Date(batch.sentAt), 'dd/MM/yyyy HH:mm') : '—'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  <StatPill
                    icon={Users}
                    label={l.recipients}
                    value={batch.totalSent + batch.totalFailed}
                    color="bg-blue-50 text-blue-700"
                  />
                  {batch.totalSent > 0 && (
                    <StatPill
                      icon={CheckCircle}
                      label={l.sent}
                      value={batch.totalSent}
                      color="bg-green-50 text-green-700"
                    />
                  )}
                  {batch.totalFailed > 0 && (
                    <StatPill
                      icon={XCircle}
                      label={l.failed}
                      value={batch.totalFailed}
                      color="bg-red-50 text-red-700"
                    />
                  )}
                  <StatPill
                    icon={Eye}
                    label={l.opens}
                    value={batch.totalOpens}
                    color="bg-indigo-50 text-indigo-700"
                  />
                  <StatPill
                    icon={MousePointerClick}
                    label={l.clicks}
                    value={batch.totalClicks}
                    color="bg-purple-50 text-purple-700"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}