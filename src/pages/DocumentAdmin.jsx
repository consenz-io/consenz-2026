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
  const { t, isRTL } = useLanguage();
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
        const newTimerEndsAt = new Date(Date.now() + data.defaultSuggestionLifetimeHours * 60 * 60 * 1000).toISOString();
        const pendingSuggestions = await base44.entities.Suggestion.filter({ documentId, status: 'pending' });
        await Promise.all(pendingSuggestions.map(s =>
          base44.entities.Suggestion.update(s.id, { timerEndsAt: newTimerEndsAt })
        ));
        return { resetCount: pendingSuggestions.length };
      }
      return { resetCount: 0 };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
      queryClient.invalidateQueries({ queryKey: ['suggestions', documentId] });
      const msg = result.resetCount > 0
        ? `ההגדרות נשמרו. הטיימרים של ${result.resetCount} הצעות ממתינות אופסו.`
        : "Document settings updated successfully!";
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
      setSuccess("Admin added successfully!");
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
      setSuccess("Admin removed successfully!");
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
        console.log('⚠️ Invitation already exists for this email');
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
      console.log('✅ Invitation created successfully for:', data.email);
      queryClient.invalidateQueries({ queryKey: ['invitations', documentId] });
      setGeneratedInviteLink(data);
      setInviteEmail("");
      if (data.isExisting) {
        setSuccess(`נמצאה הזמנה קיימת עבור ${data.email}`);
      } else {
        setSuccess(`הזמנה נוצרה עבור ${data.email}!`);
      }
      setTimeout(() => setSuccess(null), 5000);
    },
    onError: (err) => {
      console.error('❌ Invitation failed:', err);
      setError(err.message || "יצירת ההזמנה נכשלה. אנא נסה שוב.");
      setTimeout(() => setError(null), 5000);
    },
  });

  const handleCreateInvite = () => {
    console.log('📨 Attempting to create invitation...');
    
    if (!inviteEmail || !inviteEmail.trim()) {
      console.log('❌ Email field is empty');
      setError("אנא הזן כתובת מייל");
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!document || !user) {
      console.log('❌ Missing document or user data');
      setError("טוען נתונים, אנא נסה שוב בעוד רגע");
      setTimeout(() => setError(null), 3000);
      return;
    }
    
    console.log('✅ Email field validated, creating invitation');
    setGeneratedInviteLink(null);
    createInviteMutation.mutate(inviteEmail.trim());
  };

  const copyInviteLink = () => {
    if (generatedInviteLink?.signupUrl) {
      navigator.clipboard.writeText(generatedInviteLink.signupUrl);
      setSuccess("הקישור הועתק ללוח!");
      setTimeout(() => setSuccess(null), 2000);
    }
  };

  const copyInviteMessage = () => {
    if (generatedInviteLink) {
      const message = `שלום,

הוזמנת על ידי ${user.full_name} להצטרף למסמך "${document.title}" בפלטפורמת Consenz.

כדי להצטרף:
1. לחץ על הקישור הבא להרשמה
2. צור חשבון חדש או התחבר עם חשבון קיים
3. לאחר ההרשמה תוכל לגשת למסמך ולהשתתף בדיונים

קישור ההזמנה:
${generatedInviteLink.signupUrl}

בברכה,
צוות Consenz`;
      
      navigator.clipboard.writeText(message);
      setSuccess("הטקסט המלא הועתק ללוח!");
      setTimeout(() => setSuccess(null), 2000);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    updateDocMutation.mutate(formData);
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this document? This action cannot be undone.")) {
      deleteDocMutation.mutate();
    }
  };

  const handleAddAdmin = () => {
    if (!newAdminEmail || !newAdminEmail.trim()) {
      setError("Please enter an email address");
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
      setSuccess("User updated successfully!");
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
          <h1 className="text-2xl font-bold text-slate-900">Document not found</h1>
          <Button className="mt-4" onClick={() => navigate(createPageUrl("Home"))}>
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-4xl mx-auto text-center py-20">
          <h1 className="text-2xl font-bold text-slate-900">Access Denied</h1>
          <p className="text-slate-600 mt-2">You don't have permission to access this page</p>
          <Button className="mt-4" onClick={() => navigate(`${createPageUrl("DocumentView")}?id=${documentId}`)}>
            Back to Document
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <PageHeader 
          title="Document Settings"
          backUrl={`${createPageUrl("DocumentView")}?id=${documentId}`}
        />

        {/* Summary email button */}
        <div className={`flex ${isRTL ? 'justify-end' : 'justify-start'}`}>
          <Button
            onClick={() => setShowSummaryModal(true)}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 gap-2 shadow-md"
          >
            <Send className="w-4 h-4" />
            {isRTL ? 'שלח סיכום למשתתפים' : 'Send Summary to Participants'}
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
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Update document configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Document Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="privacy">Privacy Setting</Label>
                <Select
                  value={formData.privacy}
                  onValueChange={(value) => setFormData({ ...formData, privacy: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public_view_open_participation">
                      🌐 Public - Open Participation
                    </SelectItem>
                    <SelectItem value="public_view_closed_participation">
                      👀 Public View - Closed Participation
                    </SelectItem>
                    <SelectItem value="private_invite_only">
                      🔒 Private - Invite Only
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="lifetime">Default Voting Period</Label>
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
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="48">48 hours</SelectItem>
                    <SelectItem value="72">72 hours (default)</SelectItem>
                    <SelectItem value="168">1 week</SelectItem>
                    <SelectItem value="336">2 weeks</SelectItem>
                    <SelectItem value="unlimited">No time limit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className={`flex items-center justify-between p-4 bg-slate-50 rounded-lg ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`flex-1 min-w-0 ${isRTL ? 'text-right ml-4' : 'mr-4'}`}>
                  <Label htmlFor="voting" className="text-base">Enable Voting Buttons</Label>
                  <p className="text-sm text-slate-500">Allow users to vote on suggestions</p>
                </div>
                <Switch
                  id="voting"
                  checked={formData.votingButtonsEnabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, votingButtonsEnabled: checked })}
                />
              </div>

              <div className={`flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`flex-1 min-w-0 ${isRTL ? 'text-right ml-4' : 'mr-4'}`}>
                  <Label htmlFor="gamification" className="text-base">Enable Gamification System</Label>
                  <p className="text-sm text-slate-500">Require points for creating suggestions and award points for contributions</p>
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
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </form>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle>הזמנת משתתפים</CardTitle>
            <CardDescription>שלח הזמנות למשתמשים חדשים להצטרף למסמך</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="הזן כתובת מייל"
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
                dir="rtl"
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
                {createInviteMutation.isPending ? "יוצר..." : "צור קישור הזמנה"}
              </Button>
            </div>
            
            {generatedInviteLink && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3" dir="rtl">
                <div>
                  <Label className="text-sm font-semibold text-blue-900">
                    קישור הזמנה עבור: {generatedInviteLink.email}
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
                      <Copy className="w-4 h-4 ml-2" />
                      העתק קישור
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
                    <Mail className="w-4 h-4 ml-2" />
                    העתק טקסט מלא לשליחה במייל
                  </Button>
                </div>
                
                <p className="text-xs text-blue-700">
                  שלח את הקישור או את הטקסט המלא למוזמן באמצעות המייל או האפליקציה המועדפת עליך
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Document Admins</CardTitle>
            <CardDescription>Manage who can administer this document</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter user email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
              />
              <Button
                onClick={handleAddAdmin}
                disabled={addAdminMutation.isPending}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Admin
              </Button>
            </div>

            <div className="space-y-2">
              {admins.length === 0 ? (
                <p className="text-sm text-slate-500">No admins found</p>
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
                System User Management
              </CardTitle>
              <CardDescription>Manage all users in the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search users by name or email..."
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
                                  Blocked
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-600">{targetUser.email}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              Points: {targetUser.points || 1000} | Joined: {new Date(targetUser.created_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        
                        {targetUser.id !== user.id && (
                          <div className="flex items-center gap-2">
                            <Select
                              value={targetUser.role || 'user'}
                              onValueChange={(value) => {
                                if (confirm(`Change ${targetUser.full_name}'s role to ${value}?`)) {
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
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const action = targetUser.blocked ? 'unblock' : 'block';
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
                  Showing {filteredUsers.length} of {allUsers.length} users
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
            <CardTitle className="text-red-900">Danger Zone</CardTitle>
            <CardDescription className="text-red-700">Irreversible actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-red-900">Delete Document</p>
                <p className="text-sm text-red-700">This will permanently delete the document and all its data</p>
              </div>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteDocMutation.isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}