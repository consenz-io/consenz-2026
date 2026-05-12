import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/LanguageContext";
import { MessageSquare, Lightbulb, CheckCircle, Clock, XCircle, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { format } from "date-fns";

function StatCard({ icon: Icon, label, value, color, onClick, isOpen }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl p-4 flex items-center gap-3 w-full text-left transition-all ${color} ${onClick ? 'hover:opacity-80 cursor-pointer ring-offset-1 ' + (isOpen ? 'ring-2 ring-current' : '') : ''}`}
    >
      <div className="p-2 bg-white/60 rounded-lg">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs font-medium opacity-80">{label}</p>
      </div>
      {onClick && (isOpen ? <ChevronUp className="w-4 h-4 opacity-60" /> : <ChevronDown className="w-4 h-4 opacity-60" />)}
    </button>
  );
}

export default function GroupAdminDashboard({ groupMembers, allDocSuggestions, allDocComments, documents, publicProfiles, groupId }) {
  const { language } = useLanguage();
  const [openPanel, setOpenPanel] = useState(null); // 'suggestions' | 'comments' | null

  const iHe = language === 'he';
  const iAr = language === 'ar';

  const emailToProfile = useMemo(() => {
    const m = new Map();
    publicProfiles.forEach(p => { if (p.email) m.set(p.email, p); });
    return m;
  }, [publicProfiles]);

  const docMap = useMemo(() => new Map(documents.map(d => [d.id, d])), [documents]);

  const suggestionById = useMemo(() => {
    const m = new Map();
    allDocSuggestions.forEach(s => m.set(s.id, s));
    return m;
  }, [allDocSuggestions]);

  const suggestionBySectionId = useMemo(() => {
    const m = new Map();
    allDocSuggestions.forEach(s => { if (s.sectionId && !m.has(s.sectionId)) m.set(s.sectionId, s); });
    return m;
  }, [allDocSuggestions]);

  const getEmailName = (email) => emailToProfile.get(email)?.fullName || email;

  const { totalSuggestions, acceptedSuggestions, totalComments } = useMemo(() => ({
    totalSuggestions: allDocSuggestions.length,
    acceptedSuggestions: allDocSuggestions.filter(s => s.status === 'accepted').length,
    totalComments: allDocComments.length,
  }), [allDocSuggestions, allDocComments]);

  const sortedSuggestions = useMemo(
    () => [...allDocSuggestions].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)),
    [allDocSuggestions]
  );
  const sortedComments = useMemo(
    () => [...allDocComments].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)),
    [allDocComments]
  );

  const statusBadge = (status) => {
    if (status === 'accepted') return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs"><CheckCircle className="w-3 h-3 mr-1" />{iHe ? 'התקבל' : iAr ? 'مقبول' : 'Accepted'}</Badge>;
    if (status === 'rejected') return <Badge className="bg-red-100 text-red-800 border-red-200 text-xs"><XCircle className="w-3 h-3 mr-1" />{iHe ? 'נדחה' : iAr ? 'مرفوض' : 'Rejected'}</Badge>;
    return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs"><Clock className="w-3 h-3 mr-1" />{iHe ? 'ממתין' : iAr ? 'معلق' : 'Pending'}</Badge>;
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    try { return format(new Date(d), 'dd/MM/yyyy HH:mm'); } catch { return '—'; }
  };

  const toggle = (panel) => setOpenPanel(prev => prev === panel ? null : panel);

  return (
    <div className="space-y-4">
      {/* Stats row — clickable */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard
          icon={Lightbulb}
          label={iHe ? 'הצעות סה״כ' : iAr ? 'مجموع الاقتراحات' : 'Total Suggestions'}
          value={totalSuggestions}
          color="bg-purple-50 text-purple-800"
          onClick={() => toggle('suggestions')}
          isOpen={openPanel === 'suggestions'}
        />
        <StatCard
          icon={CheckCircle}
          label={iHe ? 'הצעות שהתקבלו' : iAr ? 'مقبولة' : 'Accepted'}
          value={acceptedSuggestions}
          color="bg-green-50 text-green-800"
        />
        <StatCard
          icon={MessageSquare}
          label={iHe ? 'תגובות' : iAr ? 'تعليقات' : 'Comments'}
          value={totalComments}
          color="bg-orange-50 text-orange-800"
          onClick={() => toggle('comments')}
          isOpen={openPanel === 'comments'}
        />
      </div>

      {/* Suggestions panel */}
      {openPanel === 'suggestions' && (
        <div className="border border-purple-200 rounded-xl overflow-hidden divide-y divide-slate-100">
          {sortedSuggestions.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">{iHe ? 'אין הצעות' : 'No suggestions'}</p>
          )}
          {sortedSuggestions.map(s => {
            const doc = docMap.get(s.documentId);
            return (
              <div key={s.id} className="flex items-start justify-between px-4 py-3 hover:bg-slate-50 transition-colors gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-slate-800 truncate">{s.title || (iHe ? 'ללא כותרת' : 'Untitled')}</p>
                    {statusBadge(s.status)}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {getEmailName(s.created_by)} · {fmtDate(s.created_date)}
                    {doc && <span className="mx-1">· {iHe ? 'מסמך' : 'Doc'}: {doc.title}</span>}
                  </p>
                </div>
                <Link
                  to={`${createPageUrl("suggestiondetail")}?id=${s.id}`}
                  className="text-blue-500 hover:text-blue-700 shrink-0 mt-0.5"
                  title={iHe ? 'צפה בהצעה' : 'View suggestion'}
                >
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* Comments panel */}
      {openPanel === 'comments' && (
        <div className="border border-orange-200 rounded-xl overflow-hidden divide-y divide-slate-100">
          {sortedComments.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">{iHe ? 'אין תגובות' : 'No comments'}</p>
          )}
          {sortedComments.map(c => {
            const plainText = c.content?.replace(/<[^>]*>/g, '') || '';
            let relatedSuggestion = null;
            if (c.rootEntityType === 'suggestion') {
              relatedSuggestion = suggestionById.get(c.rootEntityId);
            } else if (c.rootEntityType === 'section') {
              relatedSuggestion = suggestionBySectionId.get(c.rootEntityId);
            }
            const linkTo = relatedSuggestion
              ? `${createPageUrl("suggestiondetail")}?id=${relatedSuggestion.id}&commentId=${c.id}`
              : null;
            const doc = relatedSuggestion ? docMap.get(relatedSuggestion.documentId) : null;
            return (
              <div key={c.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400 mb-1">
                      {getEmailName(c.created_by)} · {fmtDate(c.created_date)}
                      {doc && <span className="mx-1">· {iHe ? 'מסמך' : 'Doc'}: {doc.title}</span>}
                      {relatedSuggestion && <span className="mx-1">· {iHe ? 'הצעה' : iAr ? 'اقتراح' : 'Suggestion'}: {relatedSuggestion.title}</span>}
                    </p>
                    <p className="text-sm text-slate-700 line-clamp-2">{plainText || '—'}</p>
                  </div>
                  {linkTo && (
                    <Link
                      to={linkTo}
                      className="text-blue-500 hover:text-blue-700 shrink-0 mt-0.5"
                      title={iHe ? 'צפה בתגובה בעמוד ההצעה' : 'View comment in suggestion page'}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}