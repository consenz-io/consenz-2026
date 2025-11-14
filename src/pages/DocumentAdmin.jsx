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
import { Settings, ArrowLeft, Save, Trash2, UserPlus, X, AlertCircle, CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function DocumentAdmin() {
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get('id');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [newAdminEmail, setNewAdminEmail] = useState("");

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

  const [formData, setFormData] = useState({
    title: document?.title || "",
    privacy: document?.privacy || "public_view_open_participation",
    votingButtonsEnabled: document?.votingButtonsEnabled ?? true,
    defaultSuggestionLifetimeHours: document?.defaultSuggestionLifetimeHours || 72,
  });

  React.useEffect(() => {
    if (document) {
      setFormData({
        title: document.title,
        privacy: document.privacy,
        votingButtonsEnabled: document.votingButtonsEnabled,
        defaultSuggestionLifetimeHours: document.defaultSuggestionLifetimeHours,
      });
    }
  }, [document]);

  const updateDocMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.Document.update(documentId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
      setSuccess("Document settings updated successfully!");
      setTimeout(() => setSuccess(null), 3000);
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
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(`${createPageUrl("DocumentView")}?id=${documentId}`)}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Document Settings</h1>
            <p className="text-slate-600 mt-1">{document.title}</p>
          </div>
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
                <Label htmlFor="lifetime">Default Voting Period (hours)</Label>
                <Input
                  id="lifetime"
                  type="number"
                  min="1"
                  value={formData.defaultSuggestionLifetimeHours}
                  onChange={(e) => setFormData({ ...formData, defaultSuggestionLifetimeHours: parseInt(e.target.value) })}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <Label htmlFor="voting" className="text-base">Enable Voting Buttons</Label>
                  <p className="text-sm text-slate-500">Allow users to vote on suggestions</p>
                </div>
                <Switch
                  id="voting"
                  checked={formData.votingButtonsEnabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, votingButtonsEnabled: checked })}
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