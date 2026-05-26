import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, CheckCircle, AlertCircle, Link as LinkIcon, Copy } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

export default function InviteMemberDialog({ groupId, groupName, isOpen, onClose }) {
  const { t, isRTL, language } = useLanguage();
  const queryClient = useQueryClient();
  const [inviteToken, setInviteToken] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [inviteMode, setInviteMode] = useState('email'); // 'email' or 'link'

  const sendEmailInviteMutation = useMutation({
    mutationFn: async (emailAddress) => {
      const response = await base44.functions.invoke('sendGroupInvitation', {
        groupId,
        email: emailAddress,
        groupName
      });
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to send invitation');
      }
      
      return response.data;
    },
    onSuccess: () => {
      setError(null);
      setEmail('');
      queryClient.invalidateQueries({ queryKey: ['groupInvitations', groupId] });
    },
    onError: (err) => {
      setError(err.message || (language === 'he' ? 'שגיאה בשליחת ההזמנה' : 'Error sending invitation'));
    },
  });

  const generateInviteMutation = useMutation({
    mutationFn: async () => {
      const currentUser = await base44.auth.me();
      
      // Generate unique token
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
      
      // Create invitation record
      await base44.entities.GroupInvitation.create({
        groupId,
        email: '',
        invitedBy: currentUser.id,
        token,
        status: 'pending'
      });
      
      return token;
    },
    onSuccess: (token) => {
      setInviteToken(token);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['groupInvitations', groupId] });
    },
    onError: (err) => {
      setError(err.message || (language === 'he' ? 'שגיאה ביצירת קישור' : 'Error creating link'));
    },
  });

  const inviteUrl = inviteToken 
    ? `https://consenz.net/login?groupInvite=${inviteToken}`
    : '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendEmail = () => {
    if (!email || !email.includes('@')) {
      setError(language === 'he' ? 'נא להזין כתובת אימייל תקינה' : 'Please enter a valid email address');
      return;
    }
    sendEmailInviteMutation.mutate(email);
  };

  const handleClose = () => {
    setInviteToken(null);
    setError(null);
    setCopied(false);
    setEmail('');
    setInviteMode('email');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {language === 'he' ? 'הזמן חבר חדש' : 'Invite New Member'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode selector */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setInviteMode('email')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                inviteMode === 'email'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Mail className={`w-4 h-4 inline ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {language === 'he' ? 'שליחה למייל' : 'Send by Email'}
            </button>
            <button
              type="button"
              onClick={() => setInviteMode('link')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                inviteMode === 'link'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LinkIcon className={`w-4 h-4 inline ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {language === 'he' ? 'יצירת קישור' : 'Create Link'}
            </button>
          </div>

          {inviteMode === 'email' ? (
            <>
              <p className="text-sm text-slate-600">
                {language === 'he' 
                  ? 'הזן כתובת אימייל ושלח הזמנה ישירה. ההזמנה תכלול קישור להצטרפות לקבוצה.'
                  : 'Enter an email address to send a direct invitation. The invitation will include a link to join the group.'}
              </p>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {sendEmailInviteMutation.isSuccess && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    {language === 'he' ? 'ההזמנה נשלחה בהצלחה!' : 'Invitation sent successfully!'}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">
                  {language === 'he' ? 'כתובת אימייל' : 'Email Address'}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={language === 'he' ? 'example@email.com' : 'example@email.com'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={sendEmailInviteMutation.isPending}
                  dir="ltr"
                />
              </div>

              <Button
                onClick={handleSendEmail}
                disabled={sendEmailInviteMutation.isPending || !email}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                <Mail className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {sendEmailInviteMutation.isPending 
                  ? (language === 'he' ? 'שולח...' : 'Sending...') 
                  : (language === 'he' ? 'שלח הזמנה' : 'Send Invitation')}
              </Button>
            </>
          ) : !inviteToken ? (
            <>
              <p className="text-sm text-slate-600">
                {language === 'he' 
                  ? 'צור קישור הזמנה שתוכל לשתף עם אנשים. כל מי שנרשם דרך הקישור יתווסף אוטומטית לקבוצה.'
                  : 'Create an invitation link to share with others. Anyone who signs up through this link will automatically be added to the group.'}
              </p>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={() => generateInviteMutation.mutate()}
                disabled={generateInviteMutation.isPending}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                <LinkIcon className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {generateInviteMutation.isPending 
                  ? (language === 'he' ? 'יוצר...' : 'Creating...') 
                  : (language === 'he' ? 'צור קישור הזמנה' : 'Create Invitation Link')}
              </Button>
            </>
          ) : (
            <>
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  {language === 'he' ? 'קישור ההזמנה נוצר בהצלחה!' : 'Invitation link created successfully!'}
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>
                  {language === 'he' ? 'קישור ההזמנה' : 'Invitation Link'}
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={inviteUrl}
                    readOnly
                    className="flex-1"
                    dir="ltr"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopyLink}
                  >
                    {copied ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  {language === 'he' 
                    ? 'העתק את הקישור ושלח אותו למי שתרצה להזמין'
                    : 'Copy this link and send it to anyone you want to invite'}
                </p>
              </div>
            </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant={inviteToken ? "default" : "outline"}
              onClick={handleClose}
            >
              {inviteToken 
                ? (language === 'he' ? 'סיום' : 'Done')
                : (language === 'he' ? 'ביטול' : 'Cancel')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}