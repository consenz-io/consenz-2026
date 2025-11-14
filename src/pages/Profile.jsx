import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, Mail, Shield, Sparkles, FileText, CheckCircle, AlertCircle, Edit2, Save, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const [formData, setFormData] = useState({
    full_name: user?.full_name || "",
  });

  React.useEffect(() => {
    if (user) {
      setFormData({ full_name: user.full_name || "" });
    }
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data) => {
      if (!data.full_name || data.full_name.trim().length < 2) {
        throw new Error("Display name must be at least 2 characters");
      }
      return await base44.auth.updateMe({ full_name: data.full_name.trim() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      setSuccess("Profile updated successfully!");
      setIsEditing(false);
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(err.message || "Failed to update profile");
      setTimeout(() => setError(null), 5000);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    updateProfileMutation.mutate(formData);
  };

  const handleCancel = () => {
    setFormData({ full_name: user?.full_name || "" });
    setIsEditing(false);
    setError(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-64 w-full" />
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
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Profile</h1>
          <p className="text-slate-600 mt-2">Manage your account information and view your stats</p>
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

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-3xl font-bold">{user.points || 0}</div>
                  <div className="text-sm text-blue-100">Points</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                  <FileText className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-slate-900">{user.suggestionsCreated || 0}</div>
                  <div className="text-sm text-slate-600">Suggestions</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <Shield className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900 capitalize">{user.role || 'User'}</div>
                  <div className="text-sm text-slate-600">Role</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Your account details</CardDescription>
              </div>
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={handleCancel} variant="outline" size="sm">
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSubmit}
                    disabled={updateProfileMutation.isPending}
                    size="sm"
                    className="bg-gradient-to-r from-blue-600 to-indigo-600"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                  {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <Label htmlFor="full_name" className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Display Name
                    </Label>
                    {isEditing ? (
                      <Input
                        id="full_name"
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        placeholder="Enter your display name"
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-lg font-medium text-slate-900 mt-1">{user.full_name}</p>
                    )}
                  </div>

                  <div>
                    <Label className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email
                    </Label>
                    <p className="text-slate-700 mt-1">{user.email}</p>
                    <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
                  </div>

                  <div>
                    <Label className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Role
                    </Label>
                    <div className="mt-1">
                      <Badge variant="outline" className={
                        user.role === 'admin' 
                          ? 'bg-purple-100 text-purple-800 border-purple-200'
                          : 'bg-blue-100 text-blue-800 border-blue-200'
                      }>
                        {user.role || 'user'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-xs text-slate-500">
                Member since {new Date(user.created_date).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Activity Summary</CardTitle>
            <CardDescription>Your contribution to the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-700">Total Points</span>
                <span className="font-bold text-blue-600">{user.points || 0}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-700">Suggestions Created</span>
                <span className="font-bold text-indigo-600">{user.suggestionsCreated || 0}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-700">Account Type</span>
                <Badge className={
                  user.role === 'admin' 
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-blue-100 text-blue-800'
                }>
                  {user.role || 'user'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}