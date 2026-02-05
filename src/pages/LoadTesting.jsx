import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Users, FileText, Zap, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function LoadTesting() {
  const [isCreating, setIsCreating] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const createMockDocument = async () => {
    setIsCreating(true);
    setError(null);
    setResults(null);

    try {
      const startTime = Date.now();

      // Create test document
      const doc = await base44.entities.Document.create({
        title: `בדיקת עומס - ${new Date().toLocaleString('he-IL')}`,
        urlName: `load-test-${Date.now()}`,
        description: 'מסמך לבדיקת עומס',
        privacy: 'public_view_open_participation',
        gamificationEnabled: true,
      });

      // Create 20 topics in parallel
      const topicPromises = Array.from({ length: 20 }, (_, i) =>
        base44.entities.Topic.create({
          documentId: doc.id,
          title: `נושא ${i + 1}`,
          order: i,
        })
      );
      const topics = await Promise.all(topicPromises);

      const topicsTime = Date.now();

      // Create 10 sections per topic = 200 sections total (in batches of 50)
      const allSections = [];
      for (let batch = 0; batch < 4; batch++) {
        const sectionPromises = topics.slice(batch * 5, (batch + 1) * 5).flatMap((topic, topicIdx) =>
          Array.from({ length: 10 }, (_, i) =>
            base44.entities.Section.create({
              documentId: doc.id,
              topicId: topic.id,
              content: `<p>תוכן סעיף ${i + 1} בנושא ${topicIdx + 1 + batch * 5}</p>`,
              order: i,
            })
          )
        );
        const batchSections = await Promise.all(sectionPromises);
        allSections.push(...batchSections);
      }

      const sectionsTime = Date.now();

      // Create 5 suggestions per section = 1000 suggestions (in batches of 100)
      const allSuggestions = [];
      for (let batch = 0; batch < 10; batch++) {
        const suggestionPromises = allSections.slice(batch * 20, (batch + 1) * 20).flatMap((section) =>
          Array.from({ length: 5 }, (_, i) =>
            base44.entities.Suggestion.create({
              documentId: doc.id,
              sectionId: section.id,
              topicId: section.topicId,
              type: 'edit_section',
              title: `הצעת עריכה ${i + 1}`,
              newContent: `<p>תוכן מוצע ${i + 1}</p>`,
              originalContent: section.content,
              explanation: `הסבר ${i + 1}`,
              status: 'pending',
              proVotes: Math.floor(Math.random() * 10),
              conVotes: Math.floor(Math.random() * 5),
              timerEndsAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
            })
          )
        );
        const batchSuggestions = await Promise.all(suggestionPromises);
        allSuggestions.push(...batchSuggestions);
      }

      const suggestionsTime = Date.now();

      const endTime = Date.now();

      setResults({
        documentId: doc.id,
        totalTime: endTime - startTime,
        topicsCreated: topics.length,
        topicsTime: topicsTime - startTime,
        sectionsCreated: allSections.length,
        sectionsTime: sectionsTime - topicsTime,
        suggestionsCreated: allSuggestions.length,
        suggestionsTime: suggestionsTime - sectionsTime,
        avgTimePerSuggestion: (suggestionsTime - sectionsTime) / allSuggestions.length,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const testConcurrentVotes = async (documentId) => {
    setIsCreating(true);
    setError(null);

    try {
      const startTime = Date.now();

      // Get all suggestions
      const suggestions = await base44.entities.Suggestion.filter({ documentId });

      // Create 100 concurrent votes
      const votePromises = Array.from({ length: 100 }, (_, i) => {
        const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
        return base44.entities.Vote.create({
          suggestionId: randomSuggestion.id,
          userId: user.id,
          vote: Math.random() > 0.5 ? 'pro' : 'con',
        });
      });

      await Promise.all(votePromises);

      const endTime = Date.now();

      setResults(prev => ({
        ...prev,
        concurrentVotesTime: endTime - startTime,
        avgTimePerVote: (endTime - startTime) / 100,
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">גישת מנהל נדרשת</h2>
            <p className="text-slate-600">דף זה זמין רק למנהלי מערכת</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-6 h-6" />
              בדיקות עומס ומהירות
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                בדיקות אלו יוצרות כמות גדולה של נתונים. השתמש בזהירות בסביבת ייצור.
              </AlertDescription>
            </Alert>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    בדיקת יצירת מסמך גדול
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-slate-600 space-y-1">
                    <p>• 20 נושאים</p>
                    <p>• 200 סעיפים (10 לכל נושא)</p>
                    <p>• 1000 הצעות (5 לכל סעיף)</p>
                  </div>
                  <Button
                    onClick={createMockDocument}
                    disabled={isCreating}
                    className="w-full"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    {isCreating ? 'יוצר...' : 'צור מסמך בדיקה'}
                  </Button>
                </CardContent>
              </Card>

              {results?.documentId && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      בדיקת הצבעות מקבילות
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm text-slate-600">
                      <p>100 הצבעות בו-זמנית על ההצעות במסמך</p>
                    </div>
                    <Button
                      onClick={() => testConcurrentVotes(results.documentId)}
                      disabled={isCreating}
                      className="w-full"
                    >
                      <Users className="w-4 h-4 mr-2" />
                      {isCreating ? 'מריץ...' : 'בדוק הצבעות מקבילות'}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {results && (
              <Card className="bg-green-50 border-green-200">
                <CardHeader>
                  <CardTitle className="text-lg text-green-800">תוצאות בדיקה</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Badge variant="outline" className="mb-2">זמן כולל</Badge>
                      <p className="text-2xl font-bold text-green-700">
                        {(results.totalTime / 1000).toFixed(2)}s
                      </p>
                    </div>
                    <div>
                      <Badge variant="outline" className="mb-2">הצעות שנוצרו</Badge>
                      <p className="text-2xl font-bold text-blue-700">
                        {results.suggestionsCreated}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-1 pt-4 border-t">
                    <p>נושאים: {results.topicsCreated} ({(results.topicsTime / 1000).toFixed(2)}s)</p>
                    <p>סעיפים: {results.sectionsCreated} ({(results.sectionsTime / 1000).toFixed(2)}s)</p>
                    <p>הצעות: {results.suggestionsCreated} ({(results.suggestionsTime / 1000).toFixed(2)}s)</p>
                    <p>ממוצע זמן ליצירת הצעה: {results.avgTimePerSuggestion.toFixed(0)}ms</p>
                    {results.concurrentVotesTime && (
                      <>
                        <p className="pt-2 border-t mt-2">100 הצבעות מקבילות: {(results.concurrentVotesTime / 1000).toFixed(2)}s</p>
                        <p>ממוצע זמן להצבעה: {results.avgTimePerVote.toFixed(0)}ms</p>
                      </>
                    )}
                  </div>

                  {results.documentId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/DocumentView?id=${results.documentId}`, '_blank')}
                      className="w-full mt-4"
                    >
                      פתח מסמך בדיקה
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>המלצות אופטימיזציה</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <Badge className="bg-blue-100 text-blue-800 mt-0.5">✓</Badge>
              <div>
                <p className="font-medium">Virtualization מוטמע</p>
                <p className="text-slate-600 text-xs">רשימות ארוכות משתמשות ב-react-virtuoso</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-blue-100 text-blue-800 mt-0.5">✓</Badge>
              <div>
                <p className="font-medium">Lazy loading לקומפוננטים כבדים</p>
                <p className="text-slate-600 text-xs">מודלים וסיידברים נטענים רק כשצריך</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-blue-100 text-blue-800 mt-0.5">✓</Badge>
              <div>
                <p className="font-medium">React.memo ו-useCallback</p>
                <p className="text-slate-600 text-xs">מניעת re-renders מיותרים</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-blue-100 text-blue-800 mt-0.5">✓</Badge>
              <div>
                <p className="font-medium">Optimistic updates</p>
                <p className="text-slate-600 text-xs">עדכוני UI מיידיים לפני תשובת השרת</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-green-100 text-green-800 mt-0.5">✓</Badge>
              <div>
                <p className="font-medium">Cache strategy</p>
                <p className="text-slate-600 text-xs">staleTime אופטימלי לכל סוג נתונים</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}