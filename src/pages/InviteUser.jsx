import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Mail, Send, CheckCircle, Clock, XCircle, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

export default function InviteUser() {
  const { t, isRTL } = useLanguage();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(null);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ['invitations'],
    queryFn: () => base44.entities.Invitation.list('-created_date', 50),
    initialData: [],
  });

  const sendInvitationMutation = useMutation({
    mutationFn: async (inviteEmail) => {
      if (!user) throw new Error("Must be logged in");
      
      // בדיקה אם המייל כבר מוזמן
      const existing = await base44.entities.Invitation.filter({ 
        email: inviteEmail,
        status: 'pending'
      });
      
      if (existing.length > 0) {
        throw new Error("הזמנה פעילה כבר קיימת עבור מייל זה");
      }

      // יצירת טוקן ייחודי
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // תאריך תפוגה - 7 ימים מהיום
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // יצירת ההזמנה
      const invitation = await base44.entities.Invitation.create({
        email: inviteEmail,
        invitedBy: user.email,
        status: 'pending',
        token: token,
        expiresAt: expiresAt.toISOString()
      });

      // קישור להרשמה
      const signupUrl = `${window.location.origin}?email=${encodeURIComponent(inviteEmail)}&invitation=${token}`;

      // שליחת מייל
      await base44.integrations.Core.SendEmail({
        from_name: 'Consenz Platform',
        to: inviteEmail,
        subject: `הוזמנת להצטרף לפלטפורמת Consenz על ידי ${user.full_name}`,
        body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; direction: rtl;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎉 הוזמנת להצטרף ל-Consenz</h1>
            </div>
            
            <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <p style="font-size: 18px; color: #333; line-height: 1.6;">
                שלום,
              </p>
              
              <p style="font-size: 16px; color: #555; line-height: 1.6;">
                <strong>${user.full_name}</strong> הזמין אותך להצטרף לפלטפורמת Consenz - 
                פלטפורמה לשיתוף פעולה דמוקרטי לניסוח מסמכים באמצעות קונצנזוס.
              </p>

              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 30px 0;">
                <p style="font-size: 14px; color: #666; margin: 0;">
                  💡 בפלטפורמה תוכל:
                </p>
                <ul style="color: #555; line-height: 1.8;">
                  <li>ליצור ולערוך מסמכים שיתופיים</li>
                  <li>להצביע על הצעות ולהשפיע על התוכן</li>
                  <li>לשתף פעולה עם משתמשים אחרים</li>
                  <li>לבנות קונצנזוס באמצעות דיון דמוקרטי</li>
                </ul>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${signupUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                  הצטרף עכשיו
                </a>
              </div>

              <p style="font-size: 14px; color: #999; line-height: 1.6; border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
                ההזמנה תפוג בעוד 7 ימים.<br>
                אם לא ביקשת הזמנה זו, אפשר להתעלם מהמייל.
              </p>
            </div>
          </div>
        `
      });

      return invitation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      setMessage({ type: 'success', text: 'ההזמנה נשלחה בהצלחה!' });
      setEmail("");
      setTimeout(() => setMessage(null), 5000);
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.message || 'שגיאה בשליחת ההזמנה' });
      setTimeout(() => setMessage(null), 5000);
    }
  });

  const resendInvitationMutation = useMutation({
    mutationFn: async (invitation) => {
      const signupUrl = `${window.location.origin}?email=${encodeURIComponent(invitation.email)}&invitation=${invitation.token}`;

      await base44.integrations.Core.SendEmail({
        from_name: 'Consenz Platform',
        to: invitation.email,
        subject: `תזכורת: הוזמנת להצטרף לפלטפורמת Consenz`,
        body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; direction: rtl;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🔔 תזכורת: הזמנה ל-Consenz</h1>
            </div>
            
            <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <p style="font-size: 16px; color: #555; line-height: 1.6;">
                זוהי תזכורת להזמנה שנשלחה אליך להצטרף לפלטפורמת Consenz.
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${signupUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold;">
                  הצטרף עכשיו
                </a>
              </div>

              <p style="font-size: 14px; color: #999; margin-top: 30px;">
                ההזמנה תפוג ב-${new Date(invitation.expiresAt).toLocaleDateString('he-IL')}
              </p>
            </div>
          </div>
        `
      });
    },
    onSuccess: () => {
      setMessage({ type: 'success', text: 'ההזמנה נשלחה מחדש!' });
      setTimeout(() => setMessage(null), 5000);
    },
    onError: (error) => {
      setMessage({ type: 'error', text: 'שגיאה בשליחת ההזמנה מחדש' });
      setTimeout(() => setMessage(null), 5000);
    }
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId) => {
      await base44.entities.Invitation.delete(invitationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      setMessage({ type: 'success', text: 'ההזמנה בוטלה' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMessage({ type: 'error', text: 'כתובת מייל לא תקינה' });
      setTimeout(() => setMessage(null), 5000);
      return;
    }

    sendInvitationMutation.mutate(email);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <p>יש להתחבר כדי לשלוח הזמנות</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (invitation) => {
    const isExpired = new Date(invitation.expiresAt) < new Date();
    
    if (invitation.status === 'accepted') {
      return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />התקבלה</Badge>;
    }
    if (isExpired) {
      return <Badge className="bg-gray-100 text-gray-800"><XCircle className="w-3 h-3 mr-1" />פגה תוקף</Badge>;
    }
    return <Badge className="bg-amber-100 text-amber-800"><Clock className="w-3 h-3 mr-1" />ממתינה</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">הזמן משתמשים חדשים</h1>
          <p className="text-slate-600 mt-2">שלח הזמנה למשתמשים חדשים להצטרף לפלטפורמה</p>
        </div>

        {message && (
          <Alert variant={message.type === 'error' ? 'destructive' : 'default'} className={message.type === 'success' ? 'bg-green-50 border-green-200' : ''}>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              שלח הזמנה חדשה
            </CardTitle>
            <CardDescription>
              הזמנה תישלח למייל שתזין, עם קישור להרשמה לפלטפורמה
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">כתובת מייל</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={sendInvitationMutation.isPending}
                />
              </div>
              <Button 
                type="submit" 
                disabled={sendInvitationMutation.isPending || !email.trim()}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                {sendInvitationMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    שולח הזמנה...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    שלח הזמנה
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle>הזמנות שנשלחו ({invitations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {invitations.length === 0 ? (
              <p className="text-center text-slate-500 py-8">עדיין לא נשלחו הזמנות</p>
            ) : (
              <div className="space-y-3">
                {invitations.map((invitation) => {
                  const isExpired = new Date(invitation.expiresAt) < new Date();
                  const isPending = invitation.status === 'pending' && !isExpired;
                  
                  return (
                    <div key={invitation.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900">{invitation.email}</p>
                          {getStatusBadge(invitation)}
                        </div>
                        <p className="text-sm text-slate-500 mt-1">
                          נשלח על ידי {invitation.invitedBy} • {new Date(invitation.created_date).toLocaleDateString('he-IL')}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {isExpired ? 'פג תוקף' : `פג תוקף ב-${new Date(invitation.expiresAt).toLocaleDateString('he-IL')}`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {isPending && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => resendInvitationMutation.mutate(invitation)}
                              disabled={resendInvitationMutation.isPending}
                            >
                              שלח שוב
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => cancelInvitationMutation.mutate(invitation.id)}
                              disabled={cancelInvitationMutation.isPending}
                            >
                              ביטול
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}