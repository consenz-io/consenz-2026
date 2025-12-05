import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, Mail, Shield, Sparkles, FileText, CheckCircle, AlertCircle, Edit2, Save, X, Linkedin, Twitter, Facebook, Instagram, Globe, ArrowRight, MessageSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";
import PageHeader from "../components/PageHeader";

export default function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, isRTL, language } = useLanguage();
  const [searchParams] = useSearchParams();
  const viewUserId = searchParams.get('userId');
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: viewUser, isLoading: viewUserLoading } = useQuery({
    queryKey: ['viewUser', viewUserId],
    queryFn: () => base44.entities.User.filter({ id: viewUserId }).then(users => users[0]),
    enabled: !!viewUserId,
  });

  const user = viewUserId ? viewUser : currentUser;
  const isOwnProfile = !viewUserId || (currentUser && viewUserId === currentUser.id);
  const isLoading = viewUserId ? viewUserLoading : false;

  const { data: pointsTransactions } = useQuery({
    queryKey: ['pointsTransactions', user?.id],
    queryFn: () => base44.entities.PointsTransaction.filter({ userId: user.id }, '-created_date'),
    enabled: !!user?.id,
    initialData: [],
  });

  const { data: userComments } = useQuery({
    queryKey: ['userComments', user?.email],
    queryFn: () => base44.entities.Comment.filter({ created_by: user.email }, '-created_date'),
    enabled: !!user?.email,
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-2 md:p-6">
        <div className="max-w-4xl mx-auto space-y-3 md:space-y-6 px-2 md:px-4">
          <Skeleton className="h-10 md:h-12 w-32 md:w-48" />
          <Skeleton className="h-48 md:h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    if (!viewUserId) {
      base44.auth.redirectToLogin(window.location.pathname);
    }
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-2 md:p-6 w-full max-w-full overflow-x-hidden">
      <div className="max-w-4xl mx-auto space-y-3 md:space-y-6 px-2 md:px-0 w-full max-w-full">
        <PageHeader 
          title={t('profile')}
          backUrl={createPageUrl("Home")}
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



        <Card className="bg-white overflow-hidden w-full max-w-full">
          <CardHeader className="p-3 md:p-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-2 md:gap-3">
              <div className="min-w-0">
                <CardTitle className="break-words">{t('personalInformation')}</CardTitle>
                <CardDescription className="break-words">{isOwnProfile ? 'Your account details' : `${user.full_name}'s profile`}</CardDescription>
              </div>
              {!isEditing && isOwnProfile ? (
                <Button onClick={() => setIsEditing(true)} variant="outline" size="sm" className="shrink-0">
                  <Edit2 className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {t('editProfile')}
                </Button>
              ) : isOwnProfile ? (
                <div className="flex gap-2 shrink-0">
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
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 md:space-y-6 p-3 md:p-6 w-full max-w-full">
            <div className="space-y-3 md:space-y-4 w-full max-w-full">
              <div className="flex items-start gap-2 md:gap-4">
                <div className="w-12 h-12 md:w-20 md:h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white text-xl md:text-3xl font-bold shadow-lg flex-shrink-0">
                  {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="flex-1 space-y-3 md:space-y-4 min-w-0 max-w-full overflow-hidden">
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
                      <p className="text-base md:text-lg font-medium text-slate-900 mt-1 break-words">{user.full_name}</p>
                    )}
                  </div>

                  {isOwnProfile && (
                    <div>
                      <Label className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        {t('email')}
                      </Label>
                      <p className="text-slate-700 mt-1 break-all text-sm md:text-base">{user.email}</p>
                      <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
                    </div>
                  )}

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
                {(user.bio || isOwnProfile) && (
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
                    )}

                {(user.linkedin || user.twitter || user.facebook || user.instagram || user.website || isOwnProfile) && (
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-2 block">
                      רשתות חברתיות וקישורים
                    </Label>
                    <div className="space-y-2 md:space-y-3">
                      {(user.linkedin || isEditing) && (
                        <div className="flex items-center gap-2 min-w-0">
                          <Linkedin className="w-4 h-4 md:w-5 md:h-5 text-blue-600 shrink-0" />
                          {isEditing ? (
                            <Input
                              value={formData.linkedin}
                              onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                              placeholder="https://linkedin.com/in/username"
                              className="flex-1 min-w-0 text-sm"
                            />
                          ) : user.linkedin ? (
                            <a 
                              href={user.linkedin.startsWith('http') ? user.linkedin : `https://${user.linkedin}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-xs md:text-sm flex-1 truncate min-w-0"
                            >
                              {user.linkedin}
                            </a>
                          ) : (
                            <span className="text-slate-400 text-xs md:text-sm italic">לא הוזן</span>
                          )}
                        </div>
                      )}

                      {(user.twitter || isEditing) && (
                        <div className="flex items-center gap-2 min-w-0">
                          <Twitter className="w-4 h-4 md:w-5 md:h-5 text-sky-500 shrink-0" />
                          {isEditing ? (
                            <Input
                              value={formData.twitter}
                              onChange={(e) => setFormData({ ...formData, twitter: e.target.value })}
                              placeholder="https://twitter.com/username"
                              className="flex-1 min-w-0 text-sm"
                            />
                          ) : user.twitter ? (
                            <a 
                              href={user.twitter.startsWith('http') ? user.twitter : `https://${user.twitter}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-xs md:text-sm flex-1 truncate min-w-0"
                            >
                              {user.twitter}
                            </a>
                          ) : (
                            <span className="text-slate-400 text-xs md:text-sm italic">לא הוזן</span>
                          )}
                        </div>
                      )}

                      {(user.facebook || isEditing) && (
                        <div className="flex items-center gap-2 min-w-0">
                          <Facebook className="w-4 h-4 md:w-5 md:h-5 text-blue-700 shrink-0" />
                          {isEditing ? (
                            <Input
                              value={formData.facebook}
                              onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                              placeholder="https://facebook.com/username"
                              className="flex-1 min-w-0 text-sm"
                            />
                          ) : user.facebook ? (
                            <a 
                              href={user.facebook.startsWith('http') ? user.facebook : `https://${user.facebook}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-xs md:text-sm flex-1 truncate min-w-0"
                            >
                              {user.facebook}
                            </a>
                          ) : (
                            <span className="text-slate-400 text-xs md:text-sm italic">לא הוזן</span>
                          )}
                        </div>
                      )}

                      {(user.instagram || isEditing) && (
                        <div className="flex items-center gap-2 min-w-0">
                          <Instagram className="w-4 h-4 md:w-5 md:h-5 text-pink-600 shrink-0" />
                          {isEditing ? (
                            <Input
                              value={formData.instagram}
                              onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                              placeholder="https://instagram.com/username"
                              className="flex-1 min-w-0 text-sm"
                            />
                          ) : user.instagram ? (
                            <a 
                              href={user.instagram.startsWith('http') ? user.instagram : `https://${user.instagram}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-xs md:text-sm flex-1 truncate min-w-0"
                            >
                              {user.instagram}
                            </a>
                          ) : (
                            <span className="text-slate-400 text-xs md:text-sm italic">לא הוזן</span>
                          )}
                        </div>
                      )}

                      {(user.website || isEditing) && (
                        <div className="flex items-center gap-2 min-w-0">
                          <Globe className="w-4 h-4 md:w-5 md:h-5 text-slate-600 shrink-0" />
                          {isEditing ? (
                            <Input
                              value={formData.website}
                              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                              placeholder="https://yourwebsite.com"
                              className="flex-1 min-w-0 text-sm"
                            />
                          ) : user.website ? (
                            <a 
                              href={user.website.startsWith('http') ? user.website : `https://${user.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-xs md:text-sm flex-1 truncate min-w-0"
                            >
                              {user.website}
                            </a>
                          ) : (
                            <span className="text-slate-400 text-xs md:text-sm italic">לא הוזן</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
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

        <Card className="bg-white overflow-hidden w-full max-w-full">
          <CardHeader className="p-3 md:p-6">
            <CardTitle className="break-words">{t('activitySummary')}</CardTitle>
            <CardDescription className="break-words">
              {isOwnProfile ? t('contributionDescription') : t('activityOf', { name: user.full_name })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-3 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                <Sparkles className="w-6 h-6 text-blue-600" />
                <div>
                  <p className="text-sm text-slate-500">{t('points')}</p>
                  <p className="text-xl font-bold text-slate-900">{user.points || 1000}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                <FileText className="w-6 h-6 text-green-600" />
                <div>
                  <p className="text-sm text-slate-500">
                    {isOwnProfile ? t('suggestionsPublishedByMe') : t('suggestionsPublishedBy', { name: user.full_name })}
                  </p>
                  <p className="text-xl font-bold text-slate-900">{user.suggestionsCreated || 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-lg">
                <MessageSquare className="w-6 h-6 text-orange-600" />
                <div>
                  <p className="text-sm text-slate-500">
                    {isOwnProfile ? t('commentsPublishedByMe') : t('commentsPublishedBy', { name: user.full_name })}
                  </p>
                  <p className="text-xl font-bold text-slate-900">{userComments.length || 0}</p>
                </div>
              </div>
            </div>

              <h3 className="text-lg font-bold text-slate-900 mt-6 mb-4">
                {isOwnProfile ? t('pointsHistory') : t('activityHistoryOf', { name: user.full_name })}
              </h3>
              {pointsTransactions.length === 0 && userComments.length === 0 ? (
                <p className="text-slate-500 text-sm">
                  {isOwnProfile ? t('noPointsHistory') : t('noActivityHistory')}
                </p>
              ) : (
                <div className="space-y-3">
                  {[...pointsTransactions.map(t => ({ ...t, type: 'transaction' })), ...userComments.map(c => ({ ...c, type: 'comment' }))]
                    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
                    .map((item) => {
                      if (item.type === 'transaction') {
                        const transactionUrl = item.relatedEntityType === 'suggestion' && item.relatedEntityId
                          ? `${createPageUrl("SuggestionDetail")}?id=${item.relatedEntityId}`
                          : null;

                        return (
                          <div 
                            key={`transaction-${item.id}`}
                            className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                              item.amount > 0 
                                ? 'bg-green-50 border-green-200 hover:border-green-300' 
                                : 'bg-red-50 border-red-200 hover:border-red-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs font-semibold ${
                                      item.amount > 0 
                                        ? 'bg-green-100 text-green-800 border-green-300' 
                                        : 'bg-red-100 text-red-800 border-red-300'
                                    }`}
                                  >
                                    {item.amount > 0 ? '+' : ''}{item.amount} {t('points')}
                                  </Badge>
                                  <span className="text-xs text-slate-500">
                                    {new Date(item.created_date).toLocaleDateString(
                                      language === 'en' ? 'en-US' : language === 'ar' ? 'ar-EG' : 'he-IL', 
                                      { 
                                        year: 'numeric', 
                                        month: 'short', 
                                        day: 'numeric' 
                                      }
                                    )}
                                  </span>
                                  </div>
                                  <p className="text-sm font-medium text-slate-900 mb-1">
                                  {item.action.replace(/_/g, ' ')}
                                  </p>
                                  <p className="text-sm text-slate-700">
                                  {transactionUrl ? (
                                    <Link to={transactionUrl} className="text-blue-600 hover:underline inline-flex items-center gap-1">
                                      {item.description}
                                      <ArrowRight className={`w-3 h-3 ${isRTL ? 'rotate-180' : ''}`} />
                                    </Link>
                                  ) : (
                                    item.description
                                  )}
                                  </p>
                              </div>
                            </div>
                          </div>
                        );
                      } else {
                        // Comment
                        let commentUrl = null;
                        if (item.rootEntityType === 'suggestion') {
                          commentUrl = `${createPageUrl("SuggestionDetail")}?id=${item.rootEntityId}&commentId=${item.id}`;
                        } else if (item.rootEntityType === 'section') {
                          commentUrl = `${createPageUrl("SectionHistory")}?id=${item.rootEntityId}&commentId=${item.id}`;
                        }

                        return (
                          <div 
                            key={`comment-${item.id}`}
                            className="p-4 rounded-lg border-2 bg-blue-50 border-blue-200 hover:border-blue-300 transition-all hover:shadow-md"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs font-semibold bg-blue-100 text-blue-800 border-blue-300">
                                    <MessageSquare className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                                    {t('comments')}
                                  </Badge>
                                  <span className="text-xs text-slate-500">
                                    {new Date(item.created_date).toLocaleDateString(
                                      language === 'en' ? 'en-US' : language === 'ar' ? 'ar-EG' : 'he-IL', 
                                      { 
                                        year: 'numeric', 
                                        month: 'short', 
                                        day: 'numeric' 
                                      }
                                    )}
                                  </span>
                                  </div>
                                  <p className="text-sm font-medium text-slate-900 mb-1">
                                  {t('commentOn')} {item.rootEntityType === 'suggestion' ? t('suggestion') : t('section')}
                                  </p>
                                  <p className="text-sm text-slate-700 line-clamp-2 mb-2">
                                  {item.content}
                                  </p>
                                  {commentUrl && (
                                  <Link to={commentUrl} className="text-blue-600 hover:underline inline-flex items-center gap-1 text-xs">
                                    {t('viewFullComment')}
                                    <ArrowRight className={`w-3 h-3 ${isRTL ? 'rotate-180' : ''}`} />
                                  </Link>
                                  )}
                              </div>
                            </div>
                          </div>
                        );
                      }
                    })}
                </div>
              )}
            </CardContent>
          </Card>

      </div>
    </div>
  );
}