import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Bell, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";
import PageHeader from "../components/PageHeader";

export default function EmailSettings() {
  const { t, isRTL, language } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const [frequency, setFrequency] = useState(user?.emailDigestFrequency || 'none');
  const [selectedTypes, setSelectedTypes] = useState(user?.emailDigestTypes || []);

  React.useEffect(() => {
    if (user) {
      setFrequency(user.emailDigestFrequency || 'none');
      setSelectedTypes(user.emailDigestTypes || []);
    }
  }, [user]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings) => {
      await base44.auth.updateMe(settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      setSuccess(language === 'he' ? 'ההגדרות נשמרו בהצלחה' : 'Settings saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(err.message || (language === 'he' ? 'שגיאה בשמירת ההגדרות' : 'Error saving settings'));
      setTimeout(() => setError(null), 5000);
    }
  });

  const handleSave = () => {
    updateSettingsMutation.mutate({
      emailDigestFrequency: frequency,
      emailDigestTypes: frequency === 'none' ? [] : selectedTypes
    });
  };

  const toggleType = (type) => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const notificationTypes = [
    {
      id: 'new_suggestion_in_followed_document',
      title: language === 'he' ? 'הצעות חדשות במסמכים שאני עוקב אחריהם' : 'New suggestions in followed documents',
      description: language === 'he' ? 'קבל התראה כאשר מפורסמת הצעה חדשה במסמך שאתה עוקב אחריו' : 'Get notified when a new suggestion is published in a document you follow'
    },
    {
      id: 'suggestion_status_changed',
      title: language === 'he' ? 'שינוי סטטוס הצעות שלי' : 'Status change in my suggestions',
      description: language === 'he' ? 'קבל התראה כאשר הצעה שיצרת מתקבלת או נדחית' : 'Get notified when a suggestion you created is accepted or rejected'
    },
    {
      id: 'reply_to_my_comment',
      title: language === 'he' ? 'תגובות לתגובות שלי' : 'Replies to my comments',
      description: language === 'he' ? 'קבל התראה כאשר מישהו מגיב לתגובה שכתבת' : 'Get notified when someone replies to your comment'
    },
    {
      id: 'reply_to_my_suggestion',
      title: language === 'he' ? 'תגובות להצעות שלי' : 'Comments on my suggestions',
      description: language === 'he' ? 'קבל התראה כאשר מישהו מגיב על הצעה שיצרת' : 'Get notified when someone comments on a suggestion you created'
    },
    {
      id: 'new_vote_on_suggestion',
      title: language === 'he' ? 'הצבעות על הצעות שלי' : 'Votes on my suggestions',
      description: language === 'he' ? 'קבל התראה כאשר מישהו מצביע על הצעה שיצרת' : 'Get notified when someone votes on a suggestion you created'
    },
    {
      id: 'suggestion_expiring',
      title: language === 'he' ? 'הצעות שממתינות להצבעה' : 'Suggestions awaiting vote',
      description: language === 'he' ? 'קבל תזכורת על הצעות שטרם הצבעת עליהן והתאריך שלהן עומד לפוג' : 'Get reminded about suggestions you haven\'t voted on that are about to expire'
    }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    base44.auth.redirectToLogin(window.location.pathname);
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <PageHeader 
          title={language === 'he' ? 'הגדרות עדכונים במייל' : 'Email Digest Settings'}
        />

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              {language === 'he' ? 'תדירות עדכונים' : 'Digest Frequency'}
            </CardTitle>
            <CardDescription>
              {language === 'he' 
                ? 'בחר באיזו תדירות תרצה לקבל עדכונים מרוכזים במייל'
                : 'Choose how often you want to receive email digests'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="frequency"
                  value="none"
                  checked={frequency === 'none'}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium">{language === 'he' ? 'ללא עדכונים במייל' : 'No email digests'}</div>
                  <div className="text-sm text-slate-500">
                    {language === 'he' 
                      ? 'לא אקבל עדכונים במייל (אמשיך לקבל התראות בממשק)'
                      : 'Don\'t send me email digests (I\'ll still get in-app notifications)'}
                  </div>
                </div>
              </Label>

              <Label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="frequency"
                  value="daily"
                  checked={frequency === 'daily'}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium">{language === 'he' ? 'פעם ביום' : 'Daily'}</div>
                  <div className="text-sm text-slate-500">
                    {language === 'he' 
                      ? 'קבל סיכום יומי של כל העדכונים'
                      : 'Get a daily summary of all updates'}
                  </div>
                </div>
              </Label>

              <Label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="frequency"
                  value="weekly"
                  checked={frequency === 'weekly'}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium">{language === 'he' ? 'פעם בשבוע' : 'Weekly'}</div>
                  <div className="text-sm text-slate-500">
                    {language === 'he' 
                      ? 'קבל סיכום שבועי של כל העדכונים'
                      : 'Get a weekly summary of all updates'}
                  </div>
                </div>
              </Label>
            </div>
          </CardContent>
        </Card>

        {frequency !== 'none' && (
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                {language === 'he' ? 'סוגי עדכונים' : 'Notification Types'}
              </CardTitle>
              <CardDescription>
                {language === 'he' 
                  ? 'בחר אילו סוגי התראות תרצה לכלול בעדכונים שלך'
                  : 'Choose which types of notifications to include in your digest'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {notificationTypes.map((type) => (
                <div 
                  key={type.id}
                  className="flex items-start gap-3 p-3 border rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Switch
                    checked={selectedTypes.includes(type.id)}
                    onCheckedChange={() => toggleType(type.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium">{type.title}</div>
                    <div className="text-sm text-slate-500 mt-1">{type.description}</div>
                  </div>
                </div>
              ))}

              {selectedTypes.length === 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {language === 'he' 
                      ? 'בחר לפחות סוג אחד של התראה כדי לקבל עדכונים'
                      : 'Select at least one notification type to receive updates'}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
          >
            {language === 'he' ? 'ביטול' : 'Cancel'}
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateSettingsMutation.isPending}
            className="bg-gradient-to-r from-blue-600 to-indigo-600"
          >
            {updateSettingsMutation.isPending 
              ? (language === 'he' ? 'שומר...' : 'Saving...')
              : (language === 'he' ? 'שמור הגדרות' : 'Save Settings')}
          </Button>
        </div>
      </div>
    </div>
  );
}