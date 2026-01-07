import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";
import { Mail, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";

export default function EmailLogs() {
  const { language, isRTL } = useLanguage();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: logs, isLoading } = useQuery({
    queryKey: ['emailLogs'],
    queryFn: () => base44.entities.EmailLog.list('-created_date', 100),
    initialData: [],
    enabled: !!user && user.role === 'admin',
  });

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-4xl mx-auto text-center py-20">
          <h1 className="text-2xl font-bold text-slate-900">
            {language === 'he' ? 'גישה מוגבלת' : 'Access Denied'}
          </h1>
          <p className="text-slate-600 mt-2">
            {language === 'he' ? 'רק מנהלי מערכת יכולים לצפות בלוג המיילים' : 'Only system administrators can view email logs'}
          </p>
        </div>
      </div>
    );
  }

  const purposeLabels = {
    group_invitation: language === 'he' ? 'הזמנה לקבוצה' : 'Group Invitation',
    email_digest: language === 'he' ? 'סיכום יומי' : 'Email Digest',
    notification: language === 'he' ? 'התראה' : 'Notification',
    other: language === 'he' ? 'אחר' : 'Other',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {language === 'he' ? 'לוג שליחת מיילים' : 'Email Logs'}
            </h1>
            <p className="text-slate-600 mt-2">
              {language === 'he' ? 'מעקב אחר כל שליחות המיילים במערכת' : 'Track all email deliveries in the system'}
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-white border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {language === 'he' ? 'סה"כ נשלחו' : 'Total Sent'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {logs.length}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                {language === 'he' ? 'הצליחו' : 'Successful'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {logs.filter(l => l.status === 'sent').length}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-600" />
                {language === 'he' ? 'נכשלו' : 'Failed'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {logs.filter(l => l.status === 'failed').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Logs Table */}
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle>
              {language === 'he' ? 'רשומות אחרונות' : 'Recent Logs'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">
                  {language === 'he' ? 'אין רשומות עדיין' : 'No logs yet'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={log.status === 'sent' ? 'default' : 'destructive'}
                            className={log.status === 'sent' ? 'bg-green-100 text-green-800' : ''}
                          >
                            {log.status === 'sent' ? (
                              <CheckCircle className="w-3 h-3 mr-1" />
                            ) : (
                              <XCircle className="w-3 h-3 mr-1" />
                            )}
                            {log.status === 'sent' 
                              ? (language === 'he' ? 'נשלח' : 'Sent')
                              : (language === 'he' ? 'נכשל' : 'Failed')}
                          </Badge>
                          <Badge variant="outline">
                            {purposeLabels[log.purpose] || log.purpose}
                          </Badge>
                        </div>
                        <div className="font-medium text-slate-900">
                          {log.subject}
                        </div>
                        <div className="text-sm text-slate-600">
                          <span className="font-medium">
                            {language === 'he' ? 'מאת:' : 'From:'}
                          </span>{' '}
                          {log.senderEmail}
                          {' → '}
                          <span className="font-medium">
                            {language === 'he' ? 'אל:' : 'To:'}
                          </span>{' '}
                          {log.recipientEmail}
                        </div>
                        {log.errorMessage && (
                          <div className="flex items-start gap-2 mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span className="break-all">{log.errorMessage}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 text-right whitespace-nowrap">
                        {format(new Date(log.created_date), 'dd/MM/yyyy HH:mm')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}