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
import { Mail, CheckCircle, AlertCircle } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

export default function InviteMemberDialog({ groupId, groupName, isOpen, onClose }) {
  const { t, isRTL, language } = useLanguage();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const inviteMutation = useMutation({
    mutationFn: async () => {
      // Call backend function to send invitation with service role
      await base44.functions.invoke('sendGroupInvitation', {
        groupId,
        email: email.toLowerCase(),
        groupName
      });
    },
    onSuccess: () => {
      setSuccess(true);
      setError(null);
      setEmail("");
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
      queryClient.invalidateQueries({ queryKey: ['groupInvitations', groupId] });
    },
    onError: (err) => {
      setError(err.message || (language === 'he' ? 'שגיאה בשליחת ההזמנה' : 'Error sending invitation'));
      setSuccess(false);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    
    if (!email || !email.includes('@')) {
      setError(language === 'he' ? 'נא להזין כתובת אימייל תקינה' : 'Please enter a valid email address');
      return;
    }
    
    inviteMutation.mutate();
  };

  const handleClose = () => {
    setEmail("");
    setError(null);
    setSuccess(false);
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">
              {language === 'he' ? 'כתובת אימייל' : 'Email Address'}
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={language === 'he' ? 'name@example.com' : 'name@example.com'}
              disabled={inviteMutation.isPending || success}
              className={isRTL ? 'text-right' : 'text-left'}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {language === 'he' ? 'ההזמנה נשלחה בהצלחה!' : 'Invitation sent successfully!'}
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={inviteMutation.isPending}
            >
              {language === 'he' ? 'ביטול' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              disabled={inviteMutation.isPending || success}
              className="bg-gradient-to-r from-blue-600 to-indigo-600"
            >
              <Mail className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {inviteMutation.isPending 
                ? (language === 'he' ? 'שולח...' : 'Sending...') 
                : (language === 'he' ? 'שלח הזמנה' : 'Send Invitation')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}