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
      title: 'סיכום פעילות המסמך',
      subtitle: 'מה קרה במסמך הזה מאז הקמתו?',
      generate: 'הצג סיכום',
      skip: 'עבור למסמך',
      loading: 'מייצר סיכום...',
      stats: 'נתוני הפעילות',
      suggestions_count: 'הצעות',
      comments_count: 'תגובות',
      votes_count: 'הצבעות',
      participants_count: 'משתתפים',
      go_to_suggestion: 'עבור להצעה',
      close: 'סגור',
    },
    ar: {
      title: 'ملخص نشاط الوثيقة',
      subtitle: 'ماذا حدث في هذه الوثيقة منذ إنشائها؟',
      generate: 'عرض الملخص',
      skip: 'انتقل إلى الوثيقة',
      loading: 'جارٍ إنشاء الملخص...',
      stats: 'إحصاءات النشاط',
      suggestions_count: 'مقترحات',
      comments_count: 'تعليقات',
      votes_count: 'تصويتات',
      participants_count: 'مشاركون',
      go_to_suggestion: 'انتقل إلى الاقتراح',
      close: 'إغلاق',
    },
    en: {
      title: 'Document Activity Summary',
      subtitle: 'What happened in this document since it was created?',
      generate: 'Show Summary',
      skip: 'Go to Document',
      loading: 'Generating summary...',
      stats: 'Activity Stats',
      suggestions_count: 'Suggestions',
      comments_count: 'Comments',
      votes_count: 'Votes',
      participants_count: 'Participants',
      go_to_suggestion: 'Go to suggestion',
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

    // Prepare data for the LLM
    const acceptedSuggestions = suggestions.filter(s => s.status === 'accepted');
    const pendingSuggestions = suggestions.filter(s => s.status === 'pending');
    const rejectedSuggestions = suggestions.filter(s => s.status === 'rejected');

    const suggestionLines = suggestions.map(s => {
      const author = getUserName(s.created_by);
      const proVotes = s.proVotes || 0;
      const conVotes = s.conVotes || 0;
      const commentsOnSuggestion = allComments.filter(c => c.rootEntityType === 'suggestion' && c.rootEntityId === s.id).length;
      return `- [${s.status}] "${s.title}" (מאת ${author}, ${proVotes} בעד / ${conVotes} נגד, ${commentsOnSuggestion} תגובות, ID: ${s.id})`;
    }).join('\n');

    const commentLines = allComments.slice(0, 30).map(c => {
      const author = getUserName(c.created_by);
      const snippet = (c.content || '').substring(0, 80).replace(/<[^>]*>/g, '');
      return `- ${author}: "${snippet}"`;
    }).join('\n');

    const langInstructions = {
      he: 'ענה בעברית בלבד. השתמש בשפה נייטרלית מבחינה מגדרית (למשל: "הוגשה הצעה", "נרשמו הצבעות").',
      ar: 'أجب بالعربية فقط. استخدم لغة محايدة جندياً.',
      en: 'Answer in English only. Use gender-neutral language.',
    };

    const prompt = `
You are summarizing the activity on a collaborative document titled: "${document.title}".

${langInstructions[language] || langInstructions.en}

Document statistics:
- Total suggestions: ${suggestions.length} (${acceptedSuggestions.length} accepted, ${pendingSuggestions.length} pending, ${rejectedSuggestions.length} rejected)
- Total comments: ${allComments.length}
- Total votes: ${allVotes.length}
- Unique participants: ${uniqueParticipants}

Suggestions list:
${suggestionLines}

Sample comments:
${commentLines}

Write a flowing NARRATIVE summary (3-5 paragraphs) that:
1. Describes the overall state and progress of the document
2. Highlights the most significant accepted changes and who contributed them
3. Mentions ongoing debates and pending suggestions where participants should vote (mention if there are disputes)
4. Encourages readers to participate: vote on pending suggestions if they agree or disagree, or ask questions in the comments
5. Mention specific suggestion titles by name (do NOT include IDs in the visible text)

Return a JSON object in this exact format:
{
  "summary": "the full narrative text with HTML for links. For each mentioned pending suggestion, wrap its title in: <a data-suggestion-id=\\"SUGGESTION_ID\\" class=\\"suggestion-link\\">TITLE</a>",
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
            <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
              <Sparkles className="w-12 h-12 text-indigo-300" />
              <p className="text-slate-600 text-sm max-w-sm">
                {language === 'he'
                  ? 'הבינה המלאכותית תנתח את כל ההצעות, התגובות וההצבעות ותיצור עבורך סיכום נרטיבי של הפעילות.'
                  : language === 'ar'
                  ? 'سيقوم الذكاء الاصطناعي بتحليل جميع المقترحات والتعليقات والتصويتات وإنشاء ملخص سردي للنشاط.'
                  : 'AI will analyze all suggestions, comments, and votes to create a narrative summary of activity.'}
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
            <div className="prose prose-sm max-w-none text-slate-800 leading-relaxed space-y-3 py-2">
              {renderSummary(summaryData.summary)}
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