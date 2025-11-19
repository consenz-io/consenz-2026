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
import { User, Mail, Shield, Sparkles, FileText, CheckCircle, AlertCircle, Edit2, Save, X, Linkedin, Twitter, Facebook, Instagram, Globe } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";
import PageHeader from "../components/PageHeader";

export default function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, isRTL } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: pointsTransactions } = useQuery({
    queryKey: ['pointsTransactions', user?.id],
    queryFn: () => base44.entities.PointsTransaction.filter({ userId: user.id }, '-created_date'),
    enabled: !!user?.id,
    initialData: [],
  });

  const [formData, setFormData] = useState({
    full_name: user?.full_name || "",
    bio: user?.bio || "",
    linkedin: user?.linkedin || "",
    twitter: user?.twitter || "",
    facebook: user?.facebook || "",
    instagram: user?.instagram || "",
    website: user?.website || "",
  });

  React.useEffect(() => {
    if (user) {
      setFormData({ 
        full_name: user.full_name || "",
        bio: user.bio || "",
        linkedin: user.linkedin || "",
        twitter: user.twitter || "",
        facebook: user.facebook || "",
        instagram: user.instagram || "",
        website: user.website || "",
      });
    }
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data) => {
      if (!data.full_name || data.full_name.trim().length < 2) {
        throw new Error("Display name must be at least 2 characters");
      }
      return await base44.auth.updateMe({ 
        full_name: data.full_name.trim(),
        bio: data.bio?.trim() || "",
        linkedin: data.linkedin?.trim() || "",
        twitter: data.twitter?.trim() || "",
        facebook: data.facebook?.trim() || "",
        instagram: data.instagram?.trim() || "",
        website: data.website?.trim() || "",
      });
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
    setFormData({ 
      full_name: user?.full_name || "",
      bio: user?.bio || "",
      linkedin: user?.linkedin || "",
      twitter: user?.twitter || "",
      facebook: user?.facebook || "",
      instagram: user?.instagram || "",
      website: user?.website || "",
    });
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
        <PageHeader 
          title={t('profile')}
          backUrl={createPageUrl("Home")}
        />
        
        <p className={`text-slate-600 text-center ${isRTL ? 'text-right' : ''}`}>{t('contributionDescription')}</p>

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
          <Card className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white border-2 border-blue-400">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-4xl font-bold">{user.points || 1000}</div>
                  <div className="text-sm text-blue-100 font-medium">{t('gamificationPoints')}</div>
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
                  <div className="text-sm text-slate-600">{t('suggestions')}</div>
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
                  <div className="text-sm text-slate-600">{t('role')}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>{t('personalInformation')}</CardTitle>
                <CardDescription>Your account details</CardDescription>
              </div>
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                  <Edit2 className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {t('editProfile')}
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={handleCancel} variant="outline" size="sm">
                    <X className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('cancel')}
                  </Button>
                  <Button 
                    onClick={handleSubmit}
                    disabled={updateProfileMutation.isPending}
                    size="sm"
                    className="bg-gradient-to-r from-blue-600 to-indigo-600"
                  >
                    <Save className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('saveChanges')}
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
                      {t('displayName')}
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
                      {t('email')}
                    </Label>
                    <p className="text-slate-700 mt-1">{user.email}</p>
                    <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
                  </div>

                  <div>
                    <Label className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      {t('role')}
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

              <div className="border-t pt-4 space-y-4">
                <div>
                  <Label htmlFor="bio" className="text-sm font-medium text-slate-700">
                    ביו
                  </Label>
                  {isEditing ? (
                    <textarea
                      id="bio"
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      placeholder="ספר/י קצת על עצמך..."
                      className="w-full mt-1 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px] resize-y"
                      dir={isRTL ? 'rtl' : 'ltr'}
                    />
                  ) : (
                    <p className="text-slate-700 mt-1 whitespace-pre-wrap" dir={isRTL ? 'rtl' : 'ltr'}>
                      {user.bio || <span className="text-slate-400 italic">לא הוזן ביו</span>}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-2 block">
                    רשתות חברתיות וקישורים
                  </Label>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Linkedin className="w-5 h-5 text-blue-600 shrink-0" />
                      {isEditing ? (
                        <Input
                          value={formData.linkedin}
                          onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                          placeholder="https://linkedin.com/in/username"
                          className="flex-1"
                        />
                      ) : user.linkedin ? (
                        <a 
                          href={user.linkedin.startsWith('http') ? user.linkedin : `https://${user.linkedin}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm flex-1 truncate"
                        >
                          {user.linkedin}
                        </a>
                      ) : (
                        <span className="text-slate-400 text-sm italic">לא הוזן</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Twitter className="w-5 h-5 text-sky-500 shrink-0" />
                      {isEditing ? (
                        <Input
                          value={formData.twitter}
                          onChange={(e) => setFormData({ ...formData, twitter: e.target.value })}
                          placeholder="https://twitter.com/username"
                          className="flex-1"
                        />
                      ) : user.twitter ? (
                        <a 
                          href={user.twitter.startsWith('http') ? user.twitter : `https://${user.twitter}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm flex-1 truncate"
                        >
                          {user.twitter}
                        </a>
                      ) : (
                        <span className="text-slate-400 text-sm italic">לא הוזן</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Facebook className="w-5 h-5 text-blue-700 shrink-0" />
                      {isEditing ? (
                        <Input
                          value={formData.facebook}
                          onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                          placeholder="https://facebook.com/username"
                          className="flex-1"
                        />
                      ) : user.facebook ? (
                        <a 
                          href={user.facebook.startsWith('http') ? user.facebook : `https://${user.facebook}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm flex-1 truncate"
                        >
                          {user.facebook}
                        </a>
                      ) : (
                        <span className="text-slate-400 text-sm italic">לא הוזן</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Instagram className="w-5 h-5 text-pink-600 shrink-0" />
                      {isEditing ? (
                        <Input
                          value={formData.instagram}
                          onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                          placeholder="https://instagram.com/username"
                          className="flex-1"
                        />
                      ) : user.instagram ? (
                        <a 
                          href={user.instagram.startsWith('http') ? user.instagram : `https://${user.instagram}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm flex-1 truncate"
                        >
                          {user.instagram}
                        </a>
                      ) : (
                        <span className="text-slate-400 text-sm italic">לא הוזן</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Globe className="w-5 h-5 text-slate-600 shrink-0" />
                      {isEditing ? (
                        <Input
                          value={formData.website}
                          onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                          placeholder="https://yourwebsite.com"
                          className="flex-1"
                        />
                      ) : user.website ? (
                        <a 
                          href={user.website.startsWith('http') ? user.website : `https://${user.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm flex-1 truncate"
                        >
                          {user.website}
                        </a>
                      ) : (
                        <span className="text-slate-400 text-sm italic">לא הוזן</span>
                      )}
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

        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle>{t('activitySummary')}</CardTitle>
            <CardDescription>{t('contributionDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Stats Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pb-4 border-b border-slate-200">
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="text-slate-700 font-medium text-sm">{t('gamificationPoints')}</span>
                  <span className="font-bold text-xl text-blue-600">{user.points || 1000}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-700 text-sm">{t('suggestionsCreated')}</span>
                  <span className="font-bold text-xl text-indigo-600">{user.suggestionsCreated || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-700 text-sm">{t('accountType')}</span>
                  <Badge className={
                    user.role === 'admin' 
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-blue-100 text-blue-800'
                  }>
                    {user.role || 'user'}
                  </Badge>
                </div>
              </div>

              {/* Points History */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('pointsHistory')}</h3>
                {pointsTransactions.length === 0 ? (
                  <p className="text-slate-500 text-center py-8 text-sm">{t('noPointsHistory')}</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {pointsTransactions.map((transaction) => (
                      <div 
                        key={transaction.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-900">{transaction.description}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {new Date(transaction.created_date).toLocaleString(isRTL ? 'he-IL' : 'en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <div className={`text-lg font-bold px-2 py-1 rounded ${
                          transaction.amount > 0 
                            ? 'text-green-600 bg-green-50' 
                            : 'text-red-600 bg-red-50'
                        }`}>
                          {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}