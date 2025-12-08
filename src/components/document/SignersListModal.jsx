import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, UserMinus, UserPlus } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function SignersListModal({ 
  isOpen, 
  onClose, 
  signers, 
  allUsers, 
  user, 
  userHasAgreed,
  onJoinClick,
  onRemoveSignature,
  isRemoving
}) {
  const { language, isRTL } = useLanguage();
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const content = {
    he: {
      title: "רשימת החותמים",
      joinSigners: "הצטרפות לחותמים",
      removeSignature: "הסרת החתימה שלי",
      noSignersYet: "אין חותמים עדיין",
      beFirstToSign: "היה הראשון לחתום על המסמך!",
      confirmRemoveTitle: "הסרת חתימה",
      confirmRemoveDesc: "האם אתה בטוח שברצונך להסיר את חתימתך מהמסמך?",
      cancel: "ביטול",
      confirm: "הסר חתימה"
    },
    en: {
      title: "List of Signers",
      joinSigners: "Join Signers",
      removeSignature: "Remove My Signature",
      noSignersYet: "No signers yet",
      beFirstToSign: "Be the first to sign this document!",
      confirmRemoveTitle: "Remove Signature",
      confirmRemoveDesc: "Are you sure you want to remove your signature from this document?",
      cancel: "Cancel",
      confirm: "Remove Signature"
    },
    ar: {
      title: "قائمة الموقعين",
      joinSigners: "الانضمام للموقعين",
      removeSignature: "إزالة توقيعي",
      noSignersYet: "لا يوجد موقعون بعد",
      beFirstToSign: "كن أول من يوقع على هذا المستند!",
      confirmRemoveTitle: "إزالة التوقيع",
      confirmRemoveDesc: "هل أنت متأكد أنك تريد إزالة توقيعك من هذا المستند؟",
      cancel: "إلغاء",
      confirm: "إزالة التوقيع"
    }
  };

  const c = content[language] || content.en;

  const getUserName = (signer) => {
    const foundUser = allUsers.find(u => u.id === signer.userId);
    if (foundUser?.full_name) return foundUser.full_name;
    return 'Anonymous User';
  };

  const handleRemoveClick = () => {
    setShowRemoveConfirm(true);
  };

  const handleConfirmRemove = () => {
    onRemoveSignature();
    setShowRemoveConfirm(false);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              {c.title} ({signers.length})
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {signers.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-slate-500 mb-2">{c.noSignersYet}</p>
                <p className="text-sm text-slate-400">{c.beFirstToSign}</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {signers.map((signer) => {
                  const isCurrentUser = user?.id === signer.userId;
                  return (
                    <div 
                      key={signer.id} 
                      className={`flex items-center gap-3 p-2 rounded-lg ${isCurrentUser ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-slate-50'}`}
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-medium text-sm">
                          {getUserName(signer)?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <Link 
                        to={`${createPageUrl("Profile")}?userId=${signer.userId}`}
                        className="flex-1 min-w-0"
                      >
                        <p className="font-medium text-slate-900 truncate hover:text-blue-600 transition-colors">
                          {getUserName(signer)}
                        </p>
                      </Link>
                      {isCurrentUser && (
                        <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                          {language === 'he' ? 'אתה' : language === 'ar' ? 'أنت' : 'You'}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-4 border-t border-slate-200">
              {!userHasAgreed ? (
                <Button
                  onClick={() => {
                    if (!user) {
                      base44.auth.redirectToLogin(window.location.href);
                      return;
                    }
                    onJoinClick();
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  <UserPlus className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {c.joinSigners}
                </Button>
              ) : user && (
                <Button
                  variant="outline"
                  onClick={handleRemoveClick}
                  disabled={isRemoving}
                  className="w-full text-red-600 border-red-300 hover:bg-red-50"
                >
                  <UserMinus className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {c.removeSignature}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{c.confirmRemoveTitle}</AlertDialogTitle>
            <AlertDialogDescription>{c.confirmRemoveDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isRTL ? 'flex-row-reverse' : ''}>
            <AlertDialogCancel>{c.cancel}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmRemove}
              className="bg-red-600 hover:bg-red-700"
            >
              {c.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}