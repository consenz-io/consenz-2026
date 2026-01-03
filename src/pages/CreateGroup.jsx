import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, Globe, AlertCircle } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import PageHeader from "@/components/PageHeader";

export default function CreateGroup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, isRTL, language } = useLanguage();
  const [error, setError] = useState(null);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "public",
  });

  const createGroupMutation = useMutation({
    mutationFn: async (data) => {
      if (!data.name || data.name.trim().length < 2) {
        throw new Error(language === 'he' ? 'שם הקבוצה חייב להכיל לפחות 2 תווים' : 'Group name must be at least 2 characters');
      }

      // Create the group
      const group = await base44.entities.Group.create({
        name: data.name.trim(),
        description: data.description?.trim() || "",
        status: data.status,
      });

      // Add creator as admin
      await base44.entities.GroupMember.create({
        groupId: group.id,
        userId: currentUser.id,
        role: 'admin',
      });

      return group;
    },
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groupMembers'] });
      navigate(`${createPageUrl("GroupView")}?id=${group.id}`);
    },
    onError: (err) => {
      setError(err.message || (language === 'he' ? 'שגיאה ביצירת הקבוצה' : 'Failed to create group'));
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    createGroupMutation.mutate(formData);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-2xl mx-auto">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {language === 'he' ? 'יש להתחבר כדי ליצור קבוצה' : 'Please sign in to create a group'}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <PageHeader 
          title={language === 'he' ? 'יצירת קבוצה חדשה' : language === 'ar' ? 'إنشاء مجموعة جديدة' : 'Create New Group'}
          backUrl={createPageUrl("Groups")}
        />

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{language === 'he' ? 'פרטי הקבוצה' : language === 'ar' ? 'تفاصيل المجموعة' : 'Group Details'}</CardTitle>
            <CardDescription>
              {language === 'he' ? 'מלא את הפרטים ליצירת קבוצה חדשה' : 'Fill in the details to create a new group'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">{language === 'he' ? 'שם הקבוצה' : language === 'ar' ? 'اسم المجموعة' : 'Group Name'}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={language === 'he' ? 'הזן שם לקבוצה...' : 'Enter group name...'}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{language === 'he' ? 'תיאור' : language === 'ar' ? 'وصف' : 'Description'}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={language === 'he' ? 'תאר את מטרת הקבוצה...' : 'Describe the purpose of the group...'}
                  rows={4}
                />
              </div>

              <div className="space-y-3">
                <Label>{language === 'he' ? 'פרטיות הקבוצה' : language === 'ar' ? 'خصوصية المجموعة' : 'Group Privacy'}</Label>
                <RadioGroup
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <div className="flex items-start space-x-3 space-x-reverse p-4 border rounded-lg hover:bg-slate-50 cursor-pointer">
                    <RadioGroupItem value="public" id="public" />
                    <Label htmlFor="public" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2 font-semibold mb-1">
                        <Globe className="w-4 h-4" />
                        {language === 'he' ? 'קבוצה ציבורית' : language === 'ar' ? 'مجموعة عامة' : 'Public Group'}
                      </div>
                      <p className="text-sm text-slate-500">
                        {language === 'he' ? 'כולם יכולים לראות את הקבוצה והמסמכים שלה' : 'Everyone can see the group and its documents'}
                      </p>
                    </Label>
                  </div>

                  <div className="flex items-start space-x-3 space-x-reverse p-4 border rounded-lg hover:bg-slate-50 cursor-pointer">
                    <RadioGroupItem value="private" id="private" />
                    <Label htmlFor="private" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2 font-semibold mb-1">
                        <Lock className="w-4 h-4" />
                        {language === 'he' ? 'קבוצה פרטית' : language === 'ar' ? 'مجموعة خاصة' : 'Private Group'}
                      </div>
                      <p className="text-sm text-slate-500">
                        {language === 'he' ? 'כולם יכולים לראות, דרושה אישור להצטרפות' : 'Everyone can see, approval required to join'}
                      </p>
                    </Label>
                  </div>

                  <div className="flex items-start space-x-3 space-x-reverse p-4 border rounded-lg hover:bg-slate-50 cursor-pointer">
                    <RadioGroupItem value="hidden" id="hidden" />
                    <Label htmlFor="hidden" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2 font-semibold mb-1">
                        <Lock className="w-4 h-4" />
                        {language === 'he' ? 'קבוצה חסויה' : language === 'ar' ? 'مجموعة مخفية' : 'Hidden Group'}
                      </div>
                      <p className="text-sm text-slate-500">
                        {language === 'he' ? 'רק חברי הקבוצה ומנהלי המערכת יכולים לראות' : 'Only members and system admins can see'}
                      </p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(createPageUrl("Groups"))}
                >
                  {t('cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={createGroupMutation.isPending}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600"
                >
                  {createGroupMutation.isPending 
                    ? (language === 'he' ? 'יוצר...' : 'Creating...') 
                    : (language === 'he' ? 'צור קבוצה' : language === 'ar' ? 'إنشاء مجموعة' : 'Create Group')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}