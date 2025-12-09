import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";

export default function AdminSyncProfiles() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);

  const syncProfiles = async () => {
    setSyncing(true);
    setResult(null);
    
    try {
      // Get all suggestions, votes, comments, arguments to find unique creators
      const [suggestions, votes, comments, allArguments, sections] = await Promise.all([
        base44.entities.Suggestion.list(),
        base44.entities.Vote.list(),
        base44.entities.Comment.list(),
        base44.entities.Argument.list(),
        base44.entities.Section.list()
      ]);

      // Collect unique emails from all sources
      const uniqueEmails = new Set();
      suggestions.forEach(s => s.created_by && uniqueEmails.add(s.created_by));
      votes.forEach(v => v.created_by && uniqueEmails.add(v.created_by));
      comments.forEach(c => c.created_by && uniqueEmails.add(c.created_by));
      allArguments.forEach(a => a.created_by && uniqueEmails.add(a.created_by));
      sections.forEach(s => s.created_by && uniqueEmails.add(s.created_by));

      // Get all existing public profiles
      const existingProfiles = await base44.entities.UserPublicProfile.list();
      const profileEmails = new Set(existingProfiles.map(p => p.email));

      // Get all users (admin only)
      let allUsers = [];
      try {
        allUsers = await base44.entities.User.list();
      } catch (err) {
        setResult({ 
          success: false, 
          error: 'Only admins can run this sync. You need admin access to read the User entity.' 
        });
        setSyncing(false);
        return;
      }

      // Create profiles for missing users
      const created = [];
      const skipped = [];
      const errors = [];

      for (const email of uniqueEmails) {
        if (profileEmails.has(email)) {
          skipped.push(email);
          continue;
        }

        const user = allUsers.find(u => u.email === email);
        if (!user) {
          errors.push({ email, reason: 'User not found' });
          continue;
        }

        if (!user.full_name || user.full_name.trim().length < 2) {
          errors.push({ email, reason: 'No valid full_name' });
          continue;
        }

        try {
          await base44.entities.UserPublicProfile.create({
            userId: user.id,
            email: user.email,
            fullName: user.full_name.trim()
          });
          created.push({ email, name: user.full_name });
        } catch (err) {
          errors.push({ email, reason: err.message });
        }
      }

      setResult({
        success: true,
        totalEmails: uniqueEmails.size,
        created: created.length,
        skipped: skipped.length,
        errors: errors.length,
        createdList: created,
        errorsList: errors
      });

    } catch (err) {
      setResult({ success: false, error: err.message });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>סנכרון פרופילים ציבוריים</CardTitle>
            <p className="text-sm text-slate-600">
              יוצר UserPublicProfile עבור כל המשתמשים שיצרו תוכן (הצעות, תגובות, הצבעות) אבל אין להם פרופיל ציבורי
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={syncProfiles} 
              disabled={syncing}
              className="w-full"
            >
              {syncing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  מסנכרן...
                </>
              ) : (
                'סנכרן פרופילים'
              )}
            </Button>

            {result && (
              <div className="space-y-3">
                {result.success ? (
                  <>
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-semibold">הסנכרון הושלם בהצלחה!</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{result.totalEmails}</div>
                        <div className="text-xs text-slate-600">סה"כ משתמשים פעילים</div>
                      </div>
                      <div className="bg-green-50 p-3 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{result.created}</div>
                        <div className="text-xs text-slate-600">פרופילים נוצרו</div>
                      </div>
                      <div className="bg-amber-50 p-3 rounded-lg">
                        <div className="text-2xl font-bold text-amber-600">{result.skipped}</div>
                        <div className="text-xs text-slate-600">כבר קיימים</div>
                      </div>
                    </div>

                    {result.created > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <h4 className="font-semibold text-green-800 mb-2">פרופילים שנוצרו:</h4>
                        <div className="space-y-1 text-sm">
                          {result.createdList.map((item, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <CheckCircle className="w-3 h-3 text-green-600" />
                              <span>{item.name}</span>
                              <Badge variant="outline" className="text-xs">{item.email}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.errors > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <h4 className="font-semibold text-red-800 mb-2">שגיאות:</h4>
                        <div className="space-y-1 text-sm">
                          {result.errorsList.map((item, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <AlertCircle className="w-3 h-3 text-red-600" />
                              <span>{item.email}</span>
                              <span className="text-xs text-red-600">({item.reason})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="w-5 h-5" />
                    <span>{result.error}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}