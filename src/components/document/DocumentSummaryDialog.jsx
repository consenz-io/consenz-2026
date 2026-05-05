import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, ExternalLink, MessageSquare, ThumbsUp, Edit3 } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { createPageUrl } from "@/utils";

export default function DocumentSummaryDialog({ isOpen, onClose, document, suggestions, allComments, allVotes, publicProfiles }) {
  const { language, isRTL } = useLanguage();
  const [summaryState, setSummaryState] = useState('idle');
  const [summaryData, setSummaryData] = useState(null);

  // Auto-generate on open if there's activity
  useEffect(() => {
    if (isOpen && summaryState === 'idle' && suggestions.length > 0) {
      generateSummary();
    }
  }, [isOpen]);

  const getUserName = (email) => {
    const profile = publicProfiles?.find(p => p.email === email);
    return profile?.fullName || email?.split('@')[0] || '?';
  };

  const pendingSuggestions = useMemo(() => suggestions.filter(s => s.status === 'pending'), [suggestions]);
  const acceptedSuggestions = useMemo(() => suggestions.filter(s => s.status === 'accepted'), [suggestions]);

  // Find comments that are similar to each other (same suggestion, high comment count) 
  const hotSuggestions = useMemo(() => {
    return [...pendingSuggestions]
      .map(s => ({
        ...s,
        commentCount: allComments.filter(c => c.rootEntityType === 'suggestion' && c.rootEntityId === s.id).length,
        delta: (s.proVotes || 0) - (s.conVotes || 0),
      }))
      .sort((a, b) => (b.commentCount + b.proVotes + b.conVotes) - (a.commentCount + a.proVotes + a.conVotes))
      .slice(0, 3);
  }, [pendingSuggestions, allComments]);

  // Find comment threads with replies (grouped discussion)
  const threadedComments = useMemo(() => {
    const rootComments = allComments.filter(c => !c.parentCommentId);
    return rootComments
      .map(rc => ({
        ...rc,
        replies: allComments.filter(c => c.parentCommentId === rc.id),
      }))
      .filter(rc => rc.replies.length > 0)
      .slice(0, 2);
  }, [allComments]);

  const generateSummary = async () => {
    setSummaryState('loading');

    const suggestionLines = suggestions.map(s => {
      const author = getUserName(s.created_by);
      const proVotes = s.proVotes || 0;
      const conVotes = s.conVotes || 0;
      const commentsOnSuggestion = allComments.filter(c => c.rootEntityType === 'suggestion' && c.rootEntityId === s.id);
      const commentSnippets = commentsOnSuggestion.slice(0, 3).map(c => {
        const text = (c.content || '').replace(/<[^>]*>/g, '').substring(0, 100);
        return `    - ${getUserName(c.created_by)}: "${text}"`;
      }).join('\n');
      return `- [${s.status}] "${s.title}" by ${author} | ${proVotes} pro / ${conVotes} con | ID: ${s.id}\n  Comments (${commentsOnSuggestion.length}):\n${commentSnippets}`;
    }).join('\n\n');

    const recentComments = allComments
      .filter(c => !c.parentCommentId)
      .slice(0, 20)
      .map(c => {
        const text = (c.content || '').replace(/<[^>]*>/g, '').substring(0, 120);
        const replies = allComments.filter(r => r.parentCommentId === c.id);
        return `- ${getUserName(c.created_by)}: "${text}" [${replies.length} replies]`;
      }).join('\n');

    const langInstructions = {
      he: `ענה בעברית בלבד. שפה אנושית, חמה, ישירה. אין לכתוב "המסמך", "המערכת" — כתוב כאילו אתה מספר לאדם חדש על שיחה מעניינת שקרתה פה. אין לכתוב בשפה גנרית. אין לחזור על מילה "המשתמשים" — השתמש בשמות אמיתיים.`,
      ar: `أجب بالعربية فقط. لغة إنسانية دافئة ومباشرة. استخدم الأسماء الحقيقية.`,
      en: `Answer in English only. Warm, direct, human tone. Use real names. No generic phrases like "users" or "the document".`,
    };

    const prompt = `You are writing a SHORT, engaging digest for a new visitor to the collaborative document: "${document.title}".

${langInstructions[language] || langInstructions.en}

Here is the full activity data:

=== SUGGESTIONS (with comments) ===
${suggestionLines}

=== STANDALONE COMMENTS ===
${recentComments}

Write a digest (2-3 short paragraphs MAX) that:
1. Opens with the most exciting/controversial SPECIFIC thing happening right now — name actual people, actual suggestion titles, actual comment quotes (paraphrased). Don't summarize statistics.
2. Highlights 1-2 specific comment threads where people are debating something interesting. Quote or paraphrase actual comments. If multiple commenters said similar things, group them: "Both [Name] and [Name] raised the point that..."
3. Ends with a concrete call to action: mention 1-2 SPECIFIC pending suggestions by title that need votes, and note that if someone agrees with comments they've seen, they could turn those comments into edit suggestions.

RULES:
- Mention specific names and titles — never generic language
- If there are comments that echo a pending suggestion's direction, mention this explicitly: "These comments suggest support for [suggestion title] — worth voting on if you agree"
- Keep it under 150 words total
- For each pending suggestion you mention, wrap its title: <a data-suggestion-id="REAL_ID" class="suggestion-link">TITLE</a>

Return JSON:
{
  "summary": "the digest text with HTML links as described",
  "highlightedSuggestionIds": ["id1", "id2"]
}`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          highlightedSuggestionIds: { type: 'array', items: { type: 'string' } },
        },
      },
    });

    setSummaryData(result);
    setSummaryState('done');
  };

  const renderSummary = (html) => {
    if (!html) return null;
    const parts = [];
    const regex = /<a data-suggestion-id="([^"]+)" class="suggestion-link">([^<]+)<\/a>/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(html)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={lastIndex} dangerouslySetInnerHTML={{ __html: html.slice(lastIndex, match.index) }} />);
      }
      const suggestionId = match[1];
      const title = match[2];
      const url = `${createPageUrl('DocumentView')}?id=${document.id}&openSuggestion=${suggestionId}`;
      parts.push(
        <a
          key={suggestionId}
          href={url}
          onClick={onClose}
          className="inline-flex items-center gap-1 text-indigo-700 font-semibold underline underline-offset-2 hover:text-indigo-900 bg-indigo-50 px-1 rounded"
        >
          {title}
          <ExternalLink className="w-3 h-3 inline" />
        </a>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < html.length) {
      parts.push(<span key="tail" dangerouslySetInnerHTML={{ __html: html.slice(lastIndex) }} />);
    }
    return parts;
  };

  const isHe = language === 'he';
  const isAr = language === 'ar';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-xl w-full max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
            {isHe ? `מה קורה ב"${document.title}"?` : isAr ? `ما الذي يحدث في "${document.title}"؟` : `What's happening in "${document.title}"?`}
          </DialogTitle>
          {/* Quick stats strip */}
          <div className={`flex gap-3 mt-2 text-xs text-slate-500 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {pendingSuggestions.length > 0 && (
              <span className="flex items-center gap-1">
                <ThumbsUp className="w-3 h-3 text-orange-500" />
                <strong className="text-orange-600">{pendingSuggestions.length}</strong>
                {isHe ? ' ממתינות להצבעה' : isAr ? ' بانتظار تصويتك' : ' awaiting votes'}
              </span>
            )}
            {allComments.length > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3 text-blue-500" />
                <strong className="text-blue-600">{allComments.length}</strong>
                {isHe ? ' תגובות' : isAr ? ' تعليق' : ' comments'}
              </span>
            )}
            {acceptedSuggestions.length > 0 && (
              <span className="flex items-center gap-1 text-green-600">
                ✓ <strong>{acceptedSuggestions.length}</strong>
                {isHe ? ' שינויים אושרו' : isAr ? ' تغييرات مقبولة' : ' changes accepted'}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          {summaryState === 'loading' && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
              <p className="text-slate-400 text-sm">
                {isHe ? 'קורא את הדיונים...' : isAr ? 'جارٍ قراءة النقاشات...' : 'Reading the discussions...'}
              </p>
            </div>
          )}

          {summaryState === 'done' && summaryData && (
            <div className="text-sm text-slate-800 leading-relaxed space-y-3">
              {renderSummary(summaryData.summary)}

              {/* Hot suggestions CTA */}
              {hotSuggestions.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {isHe ? 'הצעות שדורשות את דעתך' : isAr ? 'اقتراحات تحتاج رأيك' : 'Suggestions that need your input'}
                  </p>
                  {hotSuggestions.map(s => (
                    <a
                      key={s.id}
                      href={`${createPageUrl('DocumentView')}?id=${document.id}&openSuggestion=${s.id}`}
                      onClick={onClose}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-800 truncate group-hover:text-indigo-800">{s.title}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {s.proVotes || 0} {isHe ? 'בעד' : 'pro'} · {s.conVotes || 0} {isHe ? 'נגד' : 'con'}
                          {s.commentCount > 0 && ` · ${s.commentCount} ${isHe ? 'תגובות' : 'comments'}`}
                        </p>
                      </div>
                      <ThumbsUp className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-400 shrink-0 ml-2" />
                    </a>
                  ))}
                </div>
              )}

              {/* Tip: comments → suggestions */}
              <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-100 text-xs text-amber-800 flex gap-2">
                <Edit3 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                <span>
                  {isHe
                    ? 'אם קראת תגובה שמסכים/ה איתה — תוכל להפוך אותה להצעת עריכה ולהצביע לה. ככה שינויים באמת קורים.'
                    : isAr
                    ? 'إذا قرأت تعليقاً توافقه — يمكنك تحويله إلى مقترح تعديل والتصويت له. هكذا تحدث التغييرات فعلاً.'
                    : 'Agree with a comment you read? You can turn it into an edit suggestion and vote on it — that\'s how real changes happen here.'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex gap-2 px-5 py-3 border-t border-slate-100 shrink-0 bg-slate-50/50 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Button variant="outline" onClick={onClose} size="sm">
            {isHe ? 'הבנתי, אל המסמך' : isAr ? 'حسناً، إلى الوثيقة' : 'Got it, to the document'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}