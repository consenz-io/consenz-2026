import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import PageHeader from "@/components/PageHeader";

export default function EmailSettings() {
  const { t, isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const [frequency, setFrequency] = useState(user?.emailDigestFrequency || 'weekly');
  const [selectedTypes, setSelectedTypes] = useState(
    user?.emailDigestTypes || ['new_suggestion_in_followed_document', 'reply_to_my_comment', 'reply_to_my_suggestion']
  );

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings) => {
      await base44.auth.updateMe(settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      setSuccess(isRTL ? 'ההגדרות נשמרו בהצלחה' : 'Settings saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    }
  });

  const handleSave = () => {
    updateSettingsMutation.mutate({
      emailDigestFrequency: frequency,
      emailDigestTypes: selectedTypes
    });
  };

  const notificationTypes = [
    {
      id: 'new_suggestion_in_followed_document',
      label: isRTL ? 'הצעה חדשה במסמך שאני עוקב אחריו' : 'New suggestion in followed document',
      description: isRTL ? 'קבל התראה כשיש הצעה חדשה במסמך שאתה עוקב אחריו' : 'Get notified when there\'s a new suggestion in a document you follow'
    },
    {
      id: 'reply_to_my_comment',
      label: isRTL ? 'תשובה לתגובה שלי' : 'Reply to my comment',
      description: isRTL ? 'קבל התראה כשמישהו עונה לתגובה שלך' : 'Get notified when someone replies to your comment'
    },
    {
      id: 'reply_to_my_suggestion',
      label: isRTL ? 'תגובה על ההצעה שלי' : 'Comment on my suggestion',
      description: isRTL ? 'קבל התראה כשמישהו מגיב על ההצעה שלך' : 'Get notified when someone comments on your suggestion'
    },
    {
      id: 'new_vote_on_suggestion',
      label: isRTL ? 'הצבעה על ההצעה שלי' : 'Vote on my suggestion',
      description: isRTL ? 'קבל התראה כשמישהו מצביע על ההצעה שלך' : 'Get notified when someone votes on your suggestion'
    },
    {
      id: 'suggestion_status_changed',
      label: isRTL ? 'שינוי סטטוס של הצעה' : 'Suggestion status changed',
      description: isRTL ? 'קבל התראה כשההצעה שלך מתקבלת או נדחית' : 'Get notified when your suggestion is accepted or rejected'
    },
    {
      id: 'suggestion_expiring',
      label: isRTL ? 'הצעה עומדת לפוג' : 'Suggestion expiring soon',
      description: isRTL ? 'קבל התראה כשהצעה שהצבעת עליה עומדת לפוג' : 'Get notified when a suggestion you voted on is about to expire'
    }
  ];

  const toggleType = (typeId) => {
    if (selectedTypes.includes(typeId)) {
      setSelectedTypes(selectedTypes.filter(t => t !== typeId));
    } else {
      setSelectedTypes([...selectedTypes, typeId]);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-3xl mx-auto">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-3xl mx-auto text-center">
          <p>{isRTL ? 'אנא התחבר כדי לצפות בהגדרות' : 'Please sign in to view settings'}</p>
          <Button onClick={() => base44.auth.redirectToLogin()} className="mt-4">
            {isRTL ? 'התחבר' : 'Sign In'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <PageHeader 
          title={isRTL ? 'הגדרות דוא״ל והתראות' : 'Email & Notification Settings'} 
          backUrl="/profile"
        />

        {success && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              {isRTL ? 'תדירות דיוור' : 'Email Frequency'}
            </CardTitle>
            <CardDescription>
              {isRTL ? 'באיזו תדירות תרצה לקבל סיכום בדוא״ל?' : 'How often do you want to receive email digests?'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="frequency"
                  value="none"
                  checked={frequency === 'none'}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium">{isRTL ? 'כבוי' : 'None'}</div>
                  <div className="text-sm text-slate-500">
                    {isRTL ? 'לא לשלוח דוא״ל כלל (רק התראות בפלטפורמה)' : 'Don\'t send emails (platform notifications only)'}
                  </div>
                </div>
              </Label>

              <Label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="frequency"
                  value="daily"
                  checked={frequency === 'daily'}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium">{isRTL ? 'יומי' : 'Daily'}</div>
                  <div className="text-sm text-slate-500">
                    {isRTL ? 'קבל סיכום יומי של כל הפעילות' : 'Get a daily summary of all activity'}
                  </div>
                </div>
              </Label>

              <Label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="frequency"
                  value="weekly"
                  checked={frequency === 'weekly'}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium">
                    {isRTL ? 'שבועי' : 'Weekly'}
                    <Badge variant="outline" className="ml-2">{isRTL ? 'מומלץ' : 'Recommended'}</Badge>
                  </div>
                  <div className="text-sm text-slate-500">
                    {isRTL ? 'קבל סיכום שבועי של הפעילות' : 'Get a weekly summary of activity'}
                  </div>
                </div>
              </Label>
            </div>
          </CardContent>
        </Card>

        {frequency !== 'none' && (
          <Card>
            <CardHeader>
              <CardTitle>{isRTL ? 'סוגי התראות' : 'Notification Types'}</CardTitle>
              <CardDescription>
                {isRTL ? 'בחר אילו התראות תרצה לקבל בדוא״ל' : 'Choose which notifications you want to receive via email'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {notificationTypes.map(type => (
                <div key={type.id} className="flex items-start gap-3 p-4 border rounded-lg">
                  <Switch
                    checked={selectedTypes.includes(type.id)}
                    onCheckedChange={() => toggleType(type.id)}
                    id={type.id}
                  />
                  <div className="flex-1">
                    <Label htmlFor={type.id} className="font-medium cursor-pointer">
                      {type.label}
                    </Label>
                    <p className="text-sm text-slate-500 mt-1">{type.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-3">
          <Button
            onClick={handleSave}
            disabled={updateSettingsMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {updateSettingsMutation.isPending ? (
              <>
                <Loader2 className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'} animate-spin`} />
                {isRTL ? 'שומר...' : 'Saving...'}
              </>
            ) : (
              <>
                <CheckCircle className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {isRTL ? 'שמור הגדרות' : 'Save Settings'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}