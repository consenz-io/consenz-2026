import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Settings, ArrowLeft, Save, Trash2, UserPlus, X, AlertCircle, CheckCircle, Users, Search, Ban, Mail, Copy, Link2, Send } from "lucide-react";
import DocumentSummaryModal from "@/components/document/DocumentSummaryModal";
import EmailSentLog from "@/components/document/EmailSentLog";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";
import PageHeader from "../components/PageHeader";

export default function DocumentAdmin() {
  const { t, isRTL, language } = useLanguage();
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get('id');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  const { data: document, isLoading: docLoading } = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => base44.entities.Document.filter({ id: documentId }).then(docs => docs[0]),
    enabled: !!documentId,
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: isAdmin, isLoading: adminLoading } = useQuery({
    queryKey: ['isAdmin', documentId, user?.id],
    queryFn: async () => {
      if (!user?.id || !documentId) return false;
      const admins = await base44.entities.DocumentAdmin.filter({ documentId, userId: user.id });
      return admins.length > 0;
    },
    enabled: !!user?.id && !!documentId,
  });

  const { data: admins } = useQuery({
    queryKey: ['documentAdmins', documentId],
    queryFn: async () => {
      const adminRecords = await base44.entities.DocumentAdmin.filter({ documentId });
      const userIds = adminRecords.map(a => a.userId);
      const users = await base44.entities.User.list();
      return users.filter(u => userIds.includes(u.id));
    },
    enabled: !!documentId && isAdmin,
    initialData: [],
  });

  const { data: allUsers } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list('-created_date'),
    enabled: user?.role === 'admin',
    initialData: [],
  });

  const [formData, setFormData] = useState({
    title: document?.title || "",
    privacy: document?.privacy || "public_view_open_participation",
    votingButtonsEnabled: document?.votingButtonsEnabled ?? true,
    gamificationEnabled: document?.gamificationEnabled ?? false,
    defaultSuggestionLifetimeHours: document?.defaultSuggestionLifetimeHours !== undefined ? document.defaultSuggestionLifetimeHours : null,
  });

  React.useEffect(() => {
    if (document) {
      setFormData({
        title: document.title,
        privacy: document.privacy,
        votingButtonsEnabled: document.votingButtonsEnabled,
        gamificationEnabled: document.gamificationEnabled ?? false,
        defaultSuggestionLifetimeHours: document.defaultSuggestionLifetimeHours !== undefined ? document.defaultSuggestionLifetimeHours : 72,
      });
    }
  }, [document]);

  const updateDocMutation = useMutation({
    mutationFn: async (data) => {
      const lifetimeChanged = document && data.defaultSuggestionLifetimeHours !== document.defaultSuggestionLifetimeHours;
      await base44.entities.Document.update(documentId, data);
      if (lifetimeChanged) {
        const pendingSuggestions = await base44.entities.Suggestion.filter({ documentId, status: 'pending' });
        await Promise.all(pendingSuggestions.map(s => {
          // Calculate timerEndsAt relative to when this suggestion was created,
          // so older suggestions don't get a full new period reset.
          // If no time limit, set to null.
          const timerEndsAt = data.defaultSuggestionLifetimeHours === null
            ? null
            : new Date(new Date(s.created_date).getTime() + data.defaultSuggestionLifetimeHours * 60 * 60 * 1000).toISOString();
          return base44.entities.Suggestion.update(s.id, { timerEndsAt });
        }));
        return { resetCount: pendingSuggestions.length };
      }
      return { resetCount: 0 };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
      queryClient.invalidateQueries({ queryKey: ['suggestions', documentId] });
      const msg = result.resetCount > 0
        ? `${t('daSettingsSaved')} ${t('daTimersReset', { count: result.resetCount })}`
        : t('daSettingsSaved');
      setSuccess(msg);
      setTimeout(() => setSuccess(null), 4000);
    },
    onError: (err) => {
      setError(err.message || "Failed to update document");
      setTimeout(() => setError(null), 5000);
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Section.filter({ documentId }).then(sections => 
        Promise.all(sections.map(s => base44.entities.Section.delete(s.id)))
      );
      await base44.entities.Topic.filter({ documentId }).then(topics => 
        Promise.all(topics.map(t => base44.entities.Topic.delete(t.id)))
      );
      await base44.entities.Suggestion.filter({ documentId }).then(suggestions => 
        Promise.all(suggestions.map(s => base44.entities.Suggestion.delete(s.id)))
      );
      await base44.entities.DocumentAdmin.filter({ documentId }).then(admins => 
        Promise.all(admins.map(a => base44.entities.DocumentAdmin.delete(a.id)))
      );
      await base44.entities.Document.delete(documentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicDocuments'] });
      navigate(createPageUrl("Home"));
    },
    onError: (err) => {
      setError(err.message || "Failed to delete document");
    },
  });

  const addAdminMutation = useMutation({
    mutationFn: async (email) => {
      const users = await base44.entities.User.filter({ email });
      if (users.length === 0) {
        throw new Error("User not found with this email");
      }
      const targetUser = users[0];
      
      const existing = await base44.entities.DocumentAdmin.filter({ 
        documentId, 
        userId: targetUser.id 
      });
      if (existing.length > 0) {
        throw new Error("User is already an admin");
      }

      return await base44.entities.DocumentAdmin.create({
        documentId,
        userId: targetUser.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentAdmins', documentId] });
      setNewAdminEmail("");
      setSuccess(t('daAdminAdded'));
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(err.message || "Failed to add admin");
      setTimeout(() => setError(null), 5000);
    },
  });

  const removeAdminMutation = useMutation({
    mutationFn: async (userId) => {
      const adminRecords = await base44.entities.DocumentAdmin.filter({ 
        documentId, 
        userId 
      });
      if (adminRecords.length > 0) {
        await base44.entities.DocumentAdmin.delete(adminRecords[0].id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentAdmins', documentId] });
      setSuccess(t('daAdminRemoved'));
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(err.message || "Failed to remove admin");
      setTimeout(() => setError(null), 5000);
    },
  });

  const [generatedInviteLink, setGeneratedInviteLink] = useState(null);

  const createInviteMutation = useMutation({
    mutationFn: async (email) => {
      console.log('🔄 Starting invitation process for:', email.trim());
      
      // בדיקת תקינות מייל
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        throw new Error("כתובת המייל אינה תקינה");
      }

      // בדיקה אם כבר קיימת הזמנה ממתינה
      const existingInvitations = await base44.entities.Invitation.filter({ 
        documentId, 
        email: email.trim(),
        status: 'pending'
      });
      
      if (existingInvitations.length > 0) {
        const existingToken = existingInvitations[0].token;
        const signupUrl = `${window.location.origin}?invite=${existingToken}`;
        return { email: email.trim(), token: existingToken, signupUrl, isExisting: true };
      }

      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      console.log('🎟️ Generated token:', token.substring(0, 10) + '...');
      
      // יצירת הזמנה במערכת
      console.log('💾 Creating invitation record...');
      await base44.entities.Invitation.create({
        documentId,
        email: email.trim(),
        invitedBy: user.id,
        token
      });
      console.log('✅ Invitation record created');

      const signupUrl = `${window.location.origin}?invite=${token}`;
      console.log('🔗 Signup URL:', signupUrl);
      
      return { email: email.trim(), token, signupUrl, isExisting: false };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invitations', documentId] });
      setGeneratedInviteLink(data);
      setInviteEmail("");
      if (data.isExisting) {
        setSuccess(t('daInviteExists', { email: data.email }));
      } else {
        setSuccess(t('daInviteCreated', { email: data.email }));
      }
      setTimeout(() => setSuccess(null), 5000);
    },
    onError: (err) => {
      setError(err.message || "Failed to create invitation.");
      setTimeout(() => setError(null), 5000);
    },
  });

  const handleCreateInvite = () => {
    if (!inviteEmail || !inviteEmail.trim()) {
      setError(t('daEnterEmail'));
      setTimeout(() => setError(null), 3000);
      return;
    }
    if (!document || !user) {
      setError(t('loading'));
      setTimeout(() => setError(null), 3000);
      return;
    }
    setGeneratedInviteLink(null);
    createInviteMutation.mutate(inviteEmail.trim());
  };

  const copyInviteLink = () => {
    if (generatedInviteLink?.signupUrl) {
      navigator.clipboard.writeText(generatedInviteLink.signupUrl);
      setSuccess(t('daLinkCopied'));
      setTimeout(() => setSuccess(null), 2000);
    }
  };

  const copyInviteMessage = () => {
    if (generatedInviteLink) {
      const greeting = language === 'he'
        ? `שלום,\n\nהוזמנת על ידי ${user.full_name} להצטרף למסמך "${document.title}" בפלטפורמת Consenz.\n\nכדי להצטרף:\n1. לחץ על הקישור הבא להרשמה\n2. צור חשבון חדש או התחבר עם חשבון קיים\n3. לאחר ההרשמה תוכל לגשת למסמך ולהשתתף בדיונים\n\nקישור ההזמנה:\n${generatedInviteLink.signupUrl}\n\nבברכה,\nצוות Consenz`
        : language === 'ar'
        ? `مرحباً،\n\nلقد تمت دعوتك من قبل ${user.full_name} للانضمام إلى وثيقة "${document.title}" على منصة Consenz.\n\nللانضمام:\n1. انقر على الرابط التالي للتسجيل\n2. أنشئ حساباً جديداً أو سجل الدخول بحساب موجود\n3. بعد التسجيل يمكنك الوصول للوثيقة والمشاركة في النقاشات\n\nرابط الدعوة:\n${generatedInviteLink.signupUrl}\n\nمع التحية،\nفريق Consenz`
        : `Hello,\n\nYou have been invited by ${user.full_name} to join the document "${document.title}" on the Consenz platform.\n\nTo join:\n1. Click the following link to register\n2. Create a new account or sign in with an existing one\n3. After registering you will be able to access the document and participate in discussions\n\nInvitation link:\n${generatedInviteLink.signupUrl}\n\nBest regards,\nThe Consenz Team`;
      
      navigator.clipboard.writeText(greeting);
      setSuccess(t('daMessageCopied'));
      setTimeout(() => setSuccess(null), 2000);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    updateDocMutation.mutate(formData);
  };

  const handleDelete = () => {
    if (window.confirm(t('daConfirmDelete'))) {
      deleteDocMutation.mutate();
    }
  };

  const handleAddAdmin = () => {
    if (!newAdminEmail || !newAdminEmail.trim()) {
      setError(t('daEnterUserEmail'));
      return;
    }
    addAdminMutation.mutate(newAdminEmail.trim());
  };

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }) => {
      return await base44.entities.User.update(userId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      setSuccess(t('daAdminAdded'));
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(err.message || "Failed to update user");
      setTimeout(() => setError(null), 5000);
    },
  });

  const filteredUsers = allUsers.filter(u => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query)
    );
  });

  if (docLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-4xl mx-auto text-center py-20">
          <h1 className="text-2xl font-bold text-slate-900">{t('daDocumentNotFound')}</h1>
          <Button className="mt-4" onClick={() => navigate(createPageUrl("Home"))}>
            {t('daGoHome')}
          </Button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-4xl mx-auto text-center py-20">
          <h1 className="text-2xl font-bold text-slate-900">{t('daAccessDenied')}</h1>
          <p className="text-slate-600 mt-2">{t('daNoPermission')}</p>
          <Button className="mt-4" onClick={() => navigate(`${createPageUrl("DocumentView")}?id=${documentId}`)}>
            {t('daBackToDocument')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <PageHeader 
          title={t('daDocumentSettings')}
          backUrl={`${createPageUrl("DocumentView")}?id=${documentId}`}
        />

        {/* Summary email button */}
        <div className={`flex ${isRTL ? 'justify-end' : 'justify-start'}`}>
          <Button
            onClick={() => setShowSummaryModal(true)}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 gap-2 shadow-md"
          >
            <Send className="w-4 h-4" />
            {t('daSendSummary')}
          </Button>
        </div>
        
        {document && (
          <p className={`text-slate-600 ${isRTL ? 'text-right' : ''}`}>{document.title}</p>
        )}

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

        <form onSubmit={handleSubmit}>
          <Card className="bg-white">
            <CardHeader>
              <CardTitle>{t('daGeneralSettings')}</CardTitle>
              <CardDescription>{t('daUpdateDocConfig')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">{t('daDocumentTitle')}</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="privacy">{t('daPrivacySetting')}</Label>
                <Select
                  value={formData.privacy}
                  onValueChange={(value) => setFormData({ ...formData, privacy: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public_view_open_participation">
                      🌐 {t('publicViewOpenParticipation')}
                    </SelectItem>
                    <SelectItem value="public_view_closed_participation">
                      👀 {t('publicViewClosedParticipation')}
                    </SelectItem>
                    <SelectItem value="private_invite_only">
                      🔒 {t('privateInviteOnly')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="lifetime">{t('daDefaultVotingPeriod')}</Label>
                <Select
                  value={formData.defaultSuggestionLifetimeHours === null ? "unlimited" : formData.defaultSuggestionLifetimeHours?.toString()}
                  onValueChange={(value) => setFormData({ 
                    ...formData, 
                    defaultSuggestionLifetimeHours: value === "unlimited" ? null : parseInt(value)
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">{t('da24h')}</SelectItem>
                    <SelectItem value="48">{t('da48h')}</SelectItem>
                    <SelectItem value="72">{t('da72h')}</SelectItem>
                    <SelectItem value="168">{t('da1week')}</SelectItem>
                    <SelectItem value="336">{t('da2weeks')}</SelectItem>
                    <SelectItem value="unlimited">{t('daNoTimeLimit')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className={`flex items-center justify-between p-4 bg-slate-50 rounded-lg ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`flex-1 min-w-0 ${isRTL ? 'text-right ml-4' : 'mr-4'}`}>
                  <Label htmlFor="voting" className="text-base">{t('daEnableVotingButtons')}</Label>
                  <p className="text-sm text-slate-500">{t('daAllowUsersVote')}</p>
                </div>
                <Switch
                  id="voting"
                  checked={formData.votingButtonsEnabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, votingButtonsEnabled: checked })}
                />
              </div>

              <div className={`flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`flex-1 min-w-0 ${isRTL ? 'text-right ml-4' : 'mr-4'}`}>
                  <Label htmlFor="gamification" className="text-base">{t('daEnableGamification')}</Label>
                  <p className="text-sm text-slate-500">{t('daGamificationDesc')}</p>
                </div>
                <Switch
                  id="gamification"
                  checked={formData.gamificationEnabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, gamificationEnabled: checked })}
                />
              </div>

              <Button
                type="submit"
                disabled={updateDocMutation.isPending}
                className="bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                <Save className="w-4 h-4 mr-2" />
                {t('daSaveSettings')}
              </Button>
            </CardContent>
          </Card>
        </form>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle>{t('daInviteParticipants')}</CardTitle>
            <CardDescription>{t('daInviteDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder={t('daEnterEmail')}
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value);
                  setGeneratedInviteLink(null);
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateInvite();
                  }
                }}
                dir={isRTL ? 'rtl' : 'ltr'}
              />
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  handleCreateInvite();
                }}
                disabled={createInviteMutation.isPending || !document || !user}
                className="bg-green-600 hover:bg-green-700"
              >
                <Link2 className="w-4 h-4 mr-2" />
                {createInviteMutation.isPending ? t('daGenerating') : t('daCreateInviteLink')}
              </Button>
            </div>

            {generatedInviteLink && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                <div>
                  <Label className="text-sm font-semibold text-blue-900">
                    {t('daInviteLinkFor')} {generatedInviteLink.email}
                  </Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={generatedInviteLink.signupUrl}
                      readOnly
                      className="font-mono text-sm"
                      dir="ltr"
                    />
                    <Button
                      onClick={copyInviteLink}
                      variant="outline"
                      size="sm"
                    >
                      <Copy className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                      {t('daCopyLink')}
                    </Button>
                  </div>
                </div>

                <div className="pt-2 border-t border-blue-200">
                  <Button
                    onClick={copyInviteMessage}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Mail className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('daCopyFullMessage')}
                  </Button>
                </div>

                <p className="text-xs text-blue-700">
                  {t('daSendLinkHint')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle>{t('daDocumentAdmins')}</CardTitle>
            <CardDescription>{t('daManageAdmins')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder={t('daEnterUserEmail')}
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
              />
              <Button
                onClick={handleAddAdmin}
                disabled={addAdminMutation.isPending}
              >
                <UserPlus className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {t('daAddAdmin')}
              </Button>
            </div>

            <div className="space-y-2">
              {admins.length === 0 ? (
                <p className="text-sm text-slate-500">{t('daNoAdmins')}</p>
              ) : (
                admins.map((admin) => (
                  <div
                    key={admin.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{admin.full_name}</p>
                      <p className="text-sm text-slate-500">{admin.email}</p>
                    </div>
                    {admins.length > 1 && admin.id !== user.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAdminMutation.mutate(admin.id)}
                        disabled={removeAdminMutation.isPending}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {user?.role === 'admin' && (
          <Card className="bg-white border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {t('daSystemUserManagement')}
              </CardTitle>
              <CardDescription>{t('daManageAllUsers')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-slate-400" />
                  <Input
                    placeholder={t('daSearchUsers')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                </div>

                <div className="border rounded-lg divide-y max-h-[500px] overflow-y-auto">
                  {filteredUsers.map((targetUser) => (
                    <div 
                      key={targetUser.id}
                      className="p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                            {targetUser.full_name?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-slate-900">{targetUser.full_name}</p>
                              <Badge variant="outline" className={
                                targetUser.role === 'admin' 
                                  ? 'bg-purple-100 text-purple-800 border-purple-200'
                                  : 'bg-blue-100 text-blue-800 border-blue-200'
                              }>
                                {targetUser.role || 'user'}
                              </Badge>
                              {targetUser.blocked && (
                                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                                  {t('daBlocked')}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-600">{targetUser.email}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              {t('daPoints')}: {targetUser.points || 1000} | {t('daJoined')}: {new Date(targetUser.created_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        
                        {targetUser.id !== user.id && (
                          <div className="flex items-center gap-2">
                            <Select
                              value={targetUser.role || 'user'}
                              onValueChange={(value) => {
                                if (confirm(t('daConfirmRoleChange', { name: targetUser.full_name, role: value }))) {
                                  updateUserMutation.mutate({
                                    userId: targetUser.id,
                                    data: { role: value }
                                  });
                                }
                              }}
                            >
                              <SelectTrigger className="w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">{t('daRoleUser')}</SelectItem>
                                <SelectItem value="admin">{t('daRoleAdmin')}</SelectItem>
                              </SelectContent>
                            </Select>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const action = targetUser.blocked ? t('daUnblock') : t('daBlock');
                                if (confirm(`${action} ${targetUser.full_name}?`)) {
                                  updateUserMutation.mutate({
                                    userId: targetUser.id,
                                    data: { blocked: !targetUser.blocked }
                                  });
                                }
                              }}
                              className={targetUser.blocked ? 'text-green-600 border-green-300' : 'text-red-600 border-red-300'}
                            >
                              <Ban className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-sm text-slate-600 text-center pt-2">
                  {t('daShowingUsers', { filtered: filteredUsers.length, total: allUsers.length })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <EmailSentLog documentId={documentId} />

        {showSummaryModal && (
          <DocumentSummaryModal
            documentId={documentId}
            document={document}
            user={user}
            onClose={() => setShowSummaryModal(false)}
          />
        )}

        <Card className="bg-red-50 border-red-200">
          <CardHeader>
            <CardTitle className="text-red-900">{t('daDangerZone')}</CardTitle>
            <CardDescription className="text-red-700">{t('daIrreversibleActions')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-red-900">{t('daDeleteDocument')}</p>
                <p className="text-sm text-red-700">{t('daDeleteDocumentDesc')}</p>
              </div>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteDocMutation.isPending}
              >
                <Trash2 className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {t('daDelete')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}