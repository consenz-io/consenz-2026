import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, X, ExternalLink } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";

/**
 * DocumentSummaryDialog
 * Shows on every page load. Lets the user generate an AI summary of all document activity.
 */
export default function DocumentSummaryDialog({ isOpen, onClose, document, suggestions, allComments, allVotes, publicProfiles }) {
  const { language, isRTL } = useLanguage();
  const [summaryState, setSummaryState] = useState('idle'); // 'idle' | 'loading' | 'done'
  const [summaryData, setSummaryData] = useState(null); // { text, suggestionLinks }

  const labels = {
    he: {
      title: 'מה קורה במסמך?',
      subtitle: suggestions.filter(s=>s.status==='pending').length > 0
        ? `${suggestions.filter(s=>s.status==='pending').length} הצעות פתוחות מחכות להצבעתך`
        : `${allComments.length} תגובות, ${suggestions.filter(s=>s.status==='accepted').length} שינויים שהתקבלו`,
      generate: 'תן לי את הסיכום',
      skip: 'עבור למסמך',
      loading: 'קורא את הדיון...',
      suggestions_count: 'הצעות',
      comments_count: 'תגובות',
      votes_count: 'הצבעות',
      participants_count: 'משתתפים',
      close: 'סגור',
    },
    ar: {
      title: 'ما الذي يحدث في الوثيقة؟',
      subtitle: suggestions.filter(s=>s.status==='pending').length > 0
        ? `${suggestions.filter(s=>s.status==='pending').length} مقترح مفتوح ينتظر تصويتك`
        : `${allComments.length} تعليق، ${suggestions.filter(s=>s.status==='accepted').length} تغيير تمت الموافقة عليه`,
      generate: 'أعطني الملخص',
      skip: 'انتقل إلى الوثيقة',
      loading: 'أقرأ النقاش...',
      suggestions_count: 'مقترحات',
      comments_count: 'تعليقات',
      votes_count: 'تصويتات',
      participants_count: 'مشاركون',
      close: 'إغلاق',
    },
    en: {
      title: "What's happening in this document?",
      subtitle: suggestions.filter(s=>s.status==='pending').length > 0
        ? `${suggestions.filter(s=>s.status==='pending').length} open suggestions waiting for your vote`
        : `${allComments.length} comments, ${suggestions.filter(s=>s.status==='accepted').length} changes accepted`,
      generate: 'Give me the summary',
      skip: 'Go to Document',
      loading: 'Reading the discussion...',
      suggestions_count: 'Suggestions',
      comments_count: 'Comments',
      votes_count: 'Votes',
      participants_count: 'Participants',
      close: 'Close',
    },
  };

  const L = labels[language] || labels.en;

  const uniqueParticipants = React.useMemo(() => {
    const emails = new Set();
    suggestions.forEach(s => { if (s.created_by) emails.add(s.created_by); });
    allComments.forEach(c => { if (c.created_by) emails.add(c.created_by); });
    allVotes.forEach(v => { if (v.created_by) emails.add(v.created_by); });
    return emails.size;
  }, [suggestions, allComments, allVotes]);

  const getUserName = (email) => {
    const profile = publicProfiles?.find(p => p.email === email);
    return profile?.fullName || email?.split('@')[0] || 'משתמש';
  };

  const generateSummary = async () => {
    setSummaryState('loading');

    const acceptedSuggestions = suggestions.filter(s => s.status === 'accepted');
    const pendingSuggestions = suggestions.filter(s => s.status === 'pending');

    // Rich suggestion data with their comments
    const suggestionLines = suggestions.map(s => {
      const author = getUserName(s.created_by);
      const proVotes = s.proVotes || 0;
      const conVotes = s.conVotes || 0;
      const commentsOnSuggestion = allComments
        .filter(c => c.rootEntityType === 'suggestion' && c.rootEntityId === s.id)
        .map(c => `    • ${getUserName(c.created_by)}: "${(c.content || '').substring(0, 120).replace(/<[^>]*>/g, '')}"`)
        .join('\n');
      return `- [${s.status}] "${s.title}" by ${author} | ${proVotes} pro / ${conVotes} con | ID: ${s.id}\n${commentsOnSuggestion ? `  Comments:\n${commentsOnSuggestion}` : '  (no comments)'}`;
    }).join('\n\n');

    // All comments with context
    const allCommentLines = allComments.slice(0, 50).map(c => {
      const author = getUserName(c.created_by);
      const snippet = (c.content || '').substring(0, 150).replace(/<[^>]*>/g, '');
      const entityType = c.rootEntityType;
      const relatedSuggestion = entityType === 'suggestion' ? suggestions.find(s => s.id === c.rootEntityId) : null;
      const context = relatedSuggestion ? `on suggestion "${relatedSuggestion.title}"` : `on ${entityType}`;
      return `- ${author} (${context}): "${snippet}"`;
    }).join('\n');

    const langInstructions = {
      he: `ענה בעברית בלבד. שפה חיה, ישירה, נרטיבית. אל תשתמש בביטויים כלליים כמו "מגוון רחב" או "פעילות ענפה". התייחס לאנשים בשמותיהם. השתמש בשפה נייטרלית מגדרית (כלומר: "כתב/ה", "הציע/ה"). חשוב מאוד: אל תתרגם שמות משתמשים — הצג אותם בדיוק כפי שהם מופיעים בנתונים (לדוגמה: "Aharon Porath" ולא "אהרון פורת").`,
      ar: `أجب بالعربية فقط. كن مباشراً وسردياً. اذكر الناس بأسمائهم. استخدم لغة محايدة جندياً. مهم جداً: لا تترجم أسماء المستخدمين — اعرضها كما هي في البيانات (مثال: "Aharon Porath" وليس ترجمتها).`,
      en: `Answer in English only. Be direct, vivid, and narrative. Name people by name. Avoid generic phrases. IMPORTANT: Never translate user names — display them exactly as they appear in the data.`,
    };

    const prompt = `
You are writing an activity briefing for a new reader of the collaborative document titled: "${document.title}".

${langInstructions[language] || langInstructions.en}

== SUGGESTIONS AND THEIR COMMENTS ==
${suggestionLines}

== ALL COMMENTS ==
${allCommentLines}

== STATS ==
- ${acceptedSuggestions.length} suggestions accepted, ${pendingSuggestions.length} pending
- ${allComments.length} total comments, ${allVotes.length} total votes, ${uniqueParticipants} unique participants

Write 3-4 paragraphs that:

1. CONTENT FOCUS: Describe what the document is actually about and what specific changes have been proposed. Mention the accepted changes by name and describe what they changed. Do NOT just say "several changes were made" — describe the actual content.

2. WHO SAID WHAT: Name specific people and what they wrote. If multiple commenters expressed similar views or concerns, group them together and say "Both X and Y argued that...". Surface the most interesting or contested ideas.

3. COMMENTS AS POTENTIAL EDITS: Identify comments that contain substantive opinions or proposals (not just questions). Tell the reader: if these ideas resonate with them, they can turn them into edit suggestions and vote on them. Be specific — mention the comment content and who wrote it.

4. CALL TO ACTION: Name the pending suggestions by title and tell the reader concretely what they're about and why their vote matters. Make it personal and specific — e.g. "If you think X should be included, vote for [suggestion title]".

IMPORTANT: 
- Never invent content. Only refer to what's in the data above.
- For each pending suggestion you mention by title, wrap it in the link tag.
- Keep it under 350 words total.
- Be warm and engaging, not bureaucratic.

Return JSON:
{
  "summary": "narrative HTML text. For each mentioned pending suggestion title, wrap it in: <a data-suggestion-id=\\"SUGGESTION_ID\\" class=\\"suggestion-link\\">TITLE</a>",
  "highlightedSuggestionIds": ["id1", "id2"]
}
`;

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

  // Parse summary text and replace suggestion links with React Link components
  const renderSummary = (html) => {
    if (!html) return null;
    // Replace <a data-suggestion-id="X">title</a> with styled spans, keeping IDs
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
          className="inline-flex items-center gap-1 text-blue-700 font-semibold underline underline-offset-2 hover:text-blue-900"
          target="_blank"
          rel="noopener noreferrer"
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-2xl w-full max-h-[90vh] flex flex-col"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            {L.title}
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-1">{L.subtitle}</p>
        </DialogHeader>

        {/* Stats row */}
        <div className="flex flex-wrap gap-2 py-2 shrink-0">
          <Badge variant="outline" className="text-xs">
            {suggestions.length} {L.suggestions_count}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {allComments.length} {L.comments_count}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {allVotes.length} {L.votes_count}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {uniqueParticipants} {L.participants_count}
          </Badge>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {summaryState === 'idle' && (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
              <Sparkles className="w-10 h-10 text-indigo-300" />
              <p className="text-slate-700 text-sm font-medium">
                {language === 'he'
                  ? 'רוצה לקרוא סיכום של הפעילות במסמך?'
                  : language === 'ar'
                  ? 'هل تريد قراءة ملخص نشاط الوثيقة؟'
                  : 'Would you like a summary of this document\'s activity?'}
              </p>
              <p className="text-xs text-slate-400 max-w-xs">
                {language === 'he'
                  ? 'הבינה המלאכותית תנתח את הדיונים, ההצעות והתגובות ותיצור עבורך תמונה ברורה'
                  : language === 'ar'
                  ? 'سيحلل الذكاء الاصطناعي النقاشات والمقترحات والتعليقات ويعطيك صورة واضحة'
                  : 'AI will analyze discussions, suggestions, and comments to give you a clear picture'}
              </p>
            </div>
          )}

          {summaryState === 'loading' && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-slate-500 text-sm">{L.loading}</p>
            </div>
          )}

          {summaryState === 'done' && summaryData && (
            <div className="py-2 space-y-3 text-sm text-slate-800 leading-relaxed">
              {(summaryData.summary || '').split(/\n\n+/).map((para, i) => (
                <p key={i} className="leading-6">{renderSummary(para)}</p>
              ))}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className={`flex gap-2 pt-3 border-t border-slate-100 shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {summaryState === 'idle' && (
            <Button
              onClick={generateSummary}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {L.generate}
            </Button>
          )}
          <Button variant="outline" onClick={onClose} className="gap-1">
            {summaryState === 'done' ? L.close : L.skip}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}