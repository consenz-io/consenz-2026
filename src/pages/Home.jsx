import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, TrendingUp, Users, Clock, ArrowRight, ArrowLeft, Languages, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";
import { calculateContributorsFromData } from "@/components/document/calculateContributors";
import AllContributorsModal from "@/components/home/AllContributorsModal";

const detectLanguage = (text) => {
  const hebrewPattern = /[\u0590-\u05FF]/;
  const arabicPattern = /[\u0600-\u06FF]/;
  
  if (hebrewPattern.test(text)) return 'he';
  if (arabicPattern.test(text)) return 'ar';
  return 'en';
};

export default function Home() {
  const { t, isRTL, language } = useLanguage();
  const queryClient = useQueryClient();
  const [translatingDoc, setTranslatingDoc] = useState(null);
  const [showTranslated, setShowTranslated] = useState({});
  const [showContributorsModal, setShowContributorsModal] = useState(false);
  const { data: documents, isLoading } = useQuery({
    queryKey: ['publicDocuments'],
    queryFn: () => base44.entities.Document.list('-created_date', 20),
    initialData: [],
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: acceptedSuggestions } = useQuery({
    queryKey: ['acceptedSuggestions'],
    queryFn: () => base44.entities.Suggestion.filter({ status: 'accepted' }),
    initialData: [],
  });

  // Fetch all data needed for accurate contributor count
  const { data: allSuggestions } = useQuery({
    queryKey: ['allSuggestions'],
    queryFn: () => base44.entities.Suggestion.list(),
    initialData: [],
  });

  const { data: allVotes } = useQuery({
    queryKey: ['allVotes'],
    queryFn: () => base44.entities.Vote.list(),
    initialData: [],
  });

  const { data: allUsers } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const { data: allArguments } = useQuery({
    queryKey: ['allArguments'],
    queryFn: () => base44.entities.Argument.list(),
    initialData: [],
  });

  const { data: allComments } = useQuery({
    queryKey: ['allComments'],
    queryFn: () => base44.entities.Comment.list(),
    initialData: [],
  });

  const { data: allSections } = useQuery({
    queryKey: ['allSections'],
    queryFn: () => base44.entities.Section.list(),
    initialData: [],
  });

  // Calculate real contributors per document using shared logic
  const getDocumentContributors = (doc) => {
    return calculateContributorsFromData({
      document: doc,
      suggestions: allSuggestions.filter(s => s.documentId === doc.id),
      allVotes,
      allUsers,
      allArguments,
      allComments,
      sections: allSections.filter(s => s.documentId === doc.id)
    });
  };

  // Calculate unique contributors across all documents and build list
  const { totalUniqueContributors, contributorsList } = useMemo(() => {
    // Map: email -> { full_name, email, id, role }
    const contributorMap = new Map();
    
    // Helper to add contributor with name from entity fields only
    const addContributor = (email, name) => {
      if (!email) return;
      const existing = contributorMap.get(email);
      if (!existing || (!existing.full_name && name)) {
        contributorMap.set(email, {
          email,
          full_name: name || existing?.full_name || null,
          id: email,
          role: 'user'
        });
      }
    };
    
    // Document creators (no name stored)
    documents.forEach(d => {
      addContributor(d.created_by, null);
    });
    
    // Suggestion creators
    allSuggestions.forEach(s => {
      addContributor(s.created_by, s.createdByFullName);
    });
    
    // Section editors
    allSections.forEach(s => {
      addContributor(s.created_by, s.lastEditedByFullName);
      if (s.lastEditedBy && s.lastEditedBy.includes('@')) {
        addContributor(s.lastEditedBy, s.lastEditedByFullName);
      }
    });
    
    // Voters
    allVotes.forEach(v => {
      addContributor(v.created_by, v.voterFullName);
    });
    
    // Argument writers
    allArguments.forEach(arg => {
      addContributor(arg.created_by, arg.createdByFullName);
    });
    
    // Commenters
    allComments.forEach(c => {
      addContributor(c.created_by, c.createdByFullName);
    });
    
    // Build final list - use stored names or fallback to Anonymous
    const list = Array.from(contributorMap.values()).map(contributor => ({
      ...contributor,
      full_name: contributor.full_name?.trim() || 'Anonymous'
    })).sort((a, b) => a.full_name.localeCompare(b.full_name));
    
    return {
      totalUniqueContributors: Math.max(1, contributorMap.size),
      contributorsList: list
    };
  }, [documents, allSuggestions, allVotes, allArguments, allComments, allSections]);

  const calculateAverageConsensus = () => {
    if (acceptedSuggestions.length === 0) return 0;
    
    const consensusScores = acceptedSuggestions.map(s => {
      const total = (s.proVotes || 0) + (s.conVotes || 0);
      return total > 0 ? (s.proVotes / total) : 0;
    });
    
    const sum = consensusScores.reduce((acc, score) => acc + score, 0);
    return (sum / consensusScores.length * 100).toFixed(0);
  };

  const languagePrompts = {
    en: "English",
    he: "Hebrew",
    ar: "Arabic"
  };

  const translateDocumentMutation = useMutation({
    mutationFn: async (doc) => {
      const titlePrompt = `Translate the following text to ${languagePrompts[language]}. Return ONLY the translated text:\n${doc.title}`;
      const titleResult = await base44.integrations.Core.InvokeLLM({
        prompt: titlePrompt,
        add_context_from_internet: false,
      });
      const translatedTitle = (typeof titleResult === 'string' ? titleResult : titleResult.content || titleResult).trim();

      const newTranslations = {
        ...(doc.translations || {}),
        [language]: {
          title: translatedTitle
        }
      };

      await base44.entities.Document.update(doc.id, {
        translations: newTranslations
      });

      return { docId: doc.id, translations: newTranslations };
    },
    onMutate: async (doc) => {
      setTranslatingDoc(doc.id);
      setShowTranslated(prev => ({ ...prev, [doc.id]: true }));
    },
    onSuccess: (data) => {
      setTranslatingDoc(null);
      queryClient.setQueryData(['publicDocuments'], (oldData) => {
        if (!oldData) return oldData;
        return oldData.map(d => 
          d.id === data.docId 
            ? { ...d, translations: data.translations }
            : d
        );
      });
    },
    onError: () => {
      setTranslatingDoc(null);
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-indigo-600/10 to-purple-600/10" />
        <div className="relative max-w-7xl mx-auto px-6 py-20 md:py-32">
          <div className="text-center space-y-6">
            <Badge className="bg-blue-100 text-blue-700 border-blue-200 px-4 py-1">
              {t('democraticCollaboration')}
            </Badge>
            <h1 className="font-bold leading-tight">
              <span className="text-4xl md:text-6xl text-slate-900">{t('buildConsensusTitle')}</span>
              <br />
              <span className="text-2xl md:text-4xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {t('draftTogetherTitle')} {language === 'he' ? 'הסכמות והסכמים' : language === 'ar' ? 'اتفاقيات وعقود' : 'Agreements'}
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto">
              {language === 'he' 
                ? 'פלטפורמה מבוססת AI ליצירת מסמכים משותפים בקבוצות גדולות — במהירות, בשקיפות ובאופן דמוקרטי. בינה מלאכותית מסייעת בתרגום אוטומטי בין שפות, ומנגנון ההצבעות יוצר קונצנזוס דינמי שמקרב בין דעות ומבטיח שכל קול יישמע.'
                : language === 'ar'
                ? 'منصة قائمة على الذكاء الاصطناعي لإنشاء مستندات مشتركة في مجموعات كبيرة - بسرعة وشفافية وديمقراطية. يساعد الذكاء الاصطناعي في الصياغة وتكييف المحتوى لكل مشارك، مع ترجمة تلقائية بين اللغات وآلية إجماع ديناميكية تقرب الآراء وتضمن سماع كل صوت.'
                : 'AI-powered platform for creating shared documents in large groups — quickly, transparently, and democratically. AI assists in drafting and adapting content for each participant, with automatic translation across languages and a dynamic consensus mechanism that bridges opinions and ensures every voice is heard.'}
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  onClick={() => {
                    const element = document.getElementById('recent-documents-section');
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                >
                  {language === 'he' ? 'הצטרפו לדיונים' : language === 'ar' ? 'انضموا للنقاشات' : 'Join the Discussions'}
                  {isRTL ? <ArrowLeft className="w-4 h-4 mr-2" /> : <ArrowRight className="w-4 h-4 ml-2" />}
                </Button>
              <Link to={createPageUrl("LearnMore")}>
                <Button size="lg" variant="outline">
                  {t('learnMore')}
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            <Card 
              className="bg-white/80 backdrop-blur-sm border-slate-200 cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all"
              onClick={() => {
                const element = document.getElementById('recent-documents-section');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
            >
              <CardContent className="p-6 text-center">
                <FileText className="w-8 h-8 mx-auto mb-3 text-blue-600" />
                <div className="text-3xl font-bold text-slate-900">{documents.length}</div>
                <div className="text-sm text-slate-600">{t('activeDocuments')}</div>
              </CardContent>
            </Card>
            <Card 
              className="bg-white/80 backdrop-blur-sm border-slate-200 cursor-pointer hover:shadow-lg hover:border-indigo-300 transition-all"
              onClick={() => setShowContributorsModal(true)}
            >
              <CardContent className="p-6 text-center">
                <Users className="w-8 h-8 mx-auto mb-3 text-indigo-600" />
                <div className="text-3xl font-bold text-slate-900">
                  {totalUniqueContributors}
                </div>
                <div className="text-sm text-slate-600">{t('collaborators')}</div>
              </CardContent>
            </Card>
            <Link to={`${createPageUrl("LearnMore")}#consensus-calculation`}>
              <Card 
                className="bg-white/80 backdrop-blur-sm border-slate-200 cursor-pointer hover:shadow-lg hover:border-purple-300 transition-all"
              >
                <CardContent className="p-6 text-center">
                  <TrendingUp className="w-8 h-8 mx-auto mb-3 text-purple-600" />
                  <div className="text-3xl font-bold text-slate-900">
                    {calculateAverageConsensus()}%
                  </div>
                  <div className="text-sm text-slate-600">{t('avgConsensus')}</div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </section>

      {/* Recent Documents */}
      <section id="recent-documents-section" className="max-w-7xl mx-auto px-6 py-16">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">{t('recentDocuments')}</h2>
            <p className="text-slate-600 mt-2">{t('browseContribute')}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="bg-white border-slate-200">
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3 mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : documents.length === 0 ? (
          <Card className="bg-white border-slate-200">
            <CardContent className="p-12 text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">{t('noDocumentsYet')}</h3>
              <p className="text-slate-600 mb-4">{t('beFirstToCreate')}</p>
              {user && (
                <Link to={createPageUrl("CreateDocument")}>
                  <Button>{t('newDocument')}</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc) => {
              // זיהוי אוטומטי של שפה אם לא מוגדרת
              const detectedLanguage = doc.originalLanguage || detectLanguage(doc.title);
              const needsTranslation = detectedLanguage && detectedLanguage !== language;
              const translatedTitle = doc.translations?.[language]?.title;
              const hasTranslation = typeof translatedTitle === 'string' && translatedTitle;
              const displayTitle = showTranslated[doc.id] && hasTranslation 
                ? translatedTitle 
                : doc.title;

              return (
                <Card key={doc.id} className="bg-white border-slate-200 hover:shadow-lg hover:border-blue-300 transition-all duration-200 h-full">
                  <CardHeader>
                    <div className={`flex items-start justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <Link to={`${createPageUrl("DocumentView")}?id=${doc.id}`} className="flex-1 min-w-0">
                        <CardTitle className="text-lg break-words">{displayTitle}</CardTitle>
                      </Link>
                      <div className={`flex items-center gap-2 shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        {needsTranslation && (
                          translatingDoc === doc.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                          ) : !hasTranslation ? (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                translateDocumentMutation.mutate(doc);
                              }}
                              className="p-1 hover:bg-blue-50 rounded transition-colors"
                              title={t('translate')}
                            >
                              <Languages className="w-4 h-4 text-blue-600" />
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowTranslated(prev => ({ ...prev, [doc.id]: !prev[doc.id] }));
                              }}
                              className="p-1 hover:bg-slate-100 rounded transition-colors"
                              title={showTranslated[doc.id] ? t('showOriginal') : t('showTranslation')}
                            >
                              <Languages className={`w-4 h-4 ${showTranslated[doc.id] ? 'text-slate-600' : 'text-blue-600'}`} />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <Link to={`${createPageUrl("DocumentView")}?id=${doc.id}`}>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Users className="w-4 h-4" />
                          <span>{getDocumentContributors(doc)} {t('contributors')}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <TrendingUp className="w-4 h-4" />
                          <span>
                            {(() => {
                              const docSuggestions = acceptedSuggestions.filter(s => s.documentId === doc.id);
                              if (docSuggestions.length === 0) return '0';
                              const avg = docSuggestions.reduce((sum, s) => {
                                const total = (s.proVotes || 0) + (s.conVotes || 0);
                                return sum + (total > 0 ? (s.proVotes / total) : 0);
                              }, 0) / docSuggestions.length;
                              return (avg * 100).toFixed(0);
                            })()}% {t('consensus')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Clock className="w-4 h-4" />
                          <span>{new Date(doc.created_date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Link>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create New Document Button */}
        {user && documents.length > 0 && (
          <div className="flex justify-center mt-12">
            <Link to={createPageUrl("CreateDocument")}>
              <Button variant="outline" size="lg" className="border-blue-300 text-blue-700 hover:bg-blue-50">
                {t('newDocument')}
              </Button>
            </Link>
          </div>
        )}
      </section>

      <AllContributorsModal
        isOpen={showContributorsModal}
        onClose={() => setShowContributorsModal(false)}
        contributors={contributorsList}
      />
    </div>
  );
}