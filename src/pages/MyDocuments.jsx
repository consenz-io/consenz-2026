import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { useMyDocumentsData } from "@/components/myDocuments/useMyDocumentsData";
import MyDocumentCard from "@/components/myDocuments/MyDocumentCard";

export default function MyDocuments() {
  const { t, language } = useLanguage();
  const {
    user, myDocuments, suggestions, allSuggestions, allVotes,
    allUsers, allComments, allSections, isLoading, getUnvotedCount,
    myVotesCountByDoc,
  } = useMyDocumentsData();

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-6xl mx-auto text-center py-20">
          <p className="text-slate-600">{t('signIn')}</p>
        </div>
      </div>
    );
  }

  const subLabel = {
    ar: `الوثائق التي شاركت فيها (${myDocuments.length})`,
    he: `מסמכים שהשתתפת בהם (${myDocuments.length})`,
    en: `Documents you participated in (${myDocuments.length})`,
  };

  const emptyLabel = {
    ar: 'لم تشارك بعد في أي وثيقة',
    he: 'עדיין לא השתתפת באף מסמך',
    en: "You haven't participated in any document yet",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-slate-900">{t('myDocuments')}</h1>
          <p className="text-slate-600 mt-2">{subLabel[language] || subLabel.en}</p>
        </header>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 w-full" />)}
          </div>
        ) : myDocuments.length === 0 ? (
          <Card className="bg-white border-slate-200">
            <CardContent className="p-12 text-center">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">{emptyLabel[language] || emptyLabel.en}</p>
              <Link to={createPageUrl("Home")}>
                <span className="text-blue-600 hover:underline">{t('browseContribute')}</span>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...myDocuments].sort((a, b) => getUnvotedCount(b.id) - getUnvotedCount(a.id)).map(doc => (
              <MyDocumentCard
                key={doc.id}
                doc={doc}
                mySuggestionsCount={suggestions.filter(s => s.documentId === doc.id).length}
                myVotesCount={myVotesCountByDoc.get(doc.id) ?? 0}
                unvotedCount={getUnvotedCount(doc.id)}
                allSuggestions={allSuggestions}
                allVotes={allVotes}
                allUsers={allUsers}
                allComments={allComments}
                allSections={allSections}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}