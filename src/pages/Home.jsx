import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, TrendingUp, Users, Clock, ArrowRight, ArrowLeft, Languages, Loader2, Lock, Globe } from "lucide-react";
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
  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => base44.entities.Group.list('-created_date', 20),
    initialData: [],
  });

  const { data: groupMembers = [] } = useQuery({
    queryKey: ['groupMembers'],
    queryFn: () => base44.entities.GroupMember.list(),
    initialData: [],
  });

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

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list('-created_date'),
    initialData: [],
    retry: false,
    throwOnError: false,
    enabled: !!user && user?.role === 'admin', // Fetch only for confirmed admins
  });

  const { data: publicProfiles = [], isLoading: publicProfilesLoading } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
    initialData: [],
    staleTime: 60000,
    // Always fetch - it's public data available to everyone
  });

  // Use allUsers for admins (matches System User Management), publicProfiles for everyone else
  const displayedUsers = React.useMemo(() => {
    // For admins with loaded users data
    if (user?.role === 'admin' && allUsers.length > 0) {
      return allUsers;
    }
    // For everyone else (including non-logged-in users), use publicProfiles
    if (!publicProfiles || publicProfiles.length === 0) {
      return [];
    }
    // Remove duplicates from publicProfiles by userId
    const seen = new Set();
    return publicProfiles.filter(p => {
      if (!p || !p.userId) return false;
      if (seen.has(p.userId)) return false;
      seen.add(p.userId);
      return true;
    });
  }, [user, allUsers, publicProfiles]);

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
    const uniqueEmails = new Set();
    
    // Document creators
    documents.forEach(d => {
      if (d.created_by) uniqueEmails.add(d.created_by);
    });
    
    // Suggestion creators
    allSuggestions.forEach(s => {
      if (s.created_by) uniqueEmails.add(s.created_by);
    });
    
    // Voters
    const userIdToEmail = {};
    // First try public profiles (accessible to all)
    publicProfiles.forEach(p => { userIdToEmail[p.userId] = p.email; });
    // Fallback to allUsers (for admins)
    if (allUsers.length > 0) {
      allUsers.forEach(u => { userIdToEmail[u.id] = u.email; });
    }
    allVotes.forEach(v => {
      if (userIdToEmail[v.userId]) uniqueEmails.add(userIdToEmail[v.userId]);
    });
    
    // Argument writers
    allArguments.forEach(arg => {
      if (arg.created_by) uniqueEmails.add(arg.created_by);
    });
    
    // Commenters
    allComments.forEach(c => {
      if (c.created_by) uniqueEmails.add(c.created_by);
    });
    
    // Build contributors list with names
    // First map from public profiles (accessible to all)
    const emailToProfile = {};
    publicProfiles.forEach(p => { emailToProfile[p.email] = p; });
    
    // Fallback map from users (for admins or missing profiles)
    const emailToUser = {};
    if (allUsers.length > 0) {
      allUsers.forEach(u => { emailToUser[u.email] = u; });
    }
    
    const list = Array.from(uniqueEmails)
      .map(email => {
        const profile = emailToProfile[email];
        const user = emailToUser[email];

        return {
          email,
          name: profile?.fullName || user?.full_name || email.split('@')[0] || 'User',
          id: profile?.userId || user?.id
        };
      })
      .filter(contributor => contributor.name && contributor.name !== 'User')
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    return {
      totalUniqueContributors: Math.max(1, uniqueEmails.size),
      contributorsList: list
    };
  }, [documents, allSuggestions, allVotes, allUsers, publicProfiles, allArguments, allComments]);

  const calculateAverageConsensus = () => {
    if (!acceptedSuggestions || acceptedSuggestions.length === 0) return 0;
    
    const consensusScores = acceptedSuggestions
      .filter(s => s && typeof s.proVotes === 'number' && typeof s.conVotes === 'number')
      .map(s => {
        const total = s.proVotes + s.conVotes;
        return total > 0 ? (s.proVotes / total) : 0;
      });
    
    if (consensusScores.length === 0) return 0;
    
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
      <section className="relative overflow-hidden" aria-labelledby="hero-heading">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-indigo-600/10 to-purple-600/10" />
        <div className="relative max-w-7xl mx-auto px-6 py-20 md:py-32">
          <div className="text-center space-y-6">
            <Badge className="bg-blue-100 text-blue-700 border-blue-200 px-4 py-1">
              {t('democraticCollaboration')}
            </Badge>
            <h1 id="hero-heading" className="font-bold leading-tight">
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
            <button
              type="button"
              className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all w-full text-left"
              onClick={() => {
                const element = document.getElementById('recent-documents-section');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              aria-label={`${documents.length} ${t('activeDocuments')}. ${language === 'he' ? 'לחץ לגלילה למסמכים' : 'Click to scroll to documents'}`}
            >
              <div className="p-6 text-center">
                <FileText className="w-8 h-8 mx-auto mb-3 text-blue-600" aria-hidden="true" />
                <div className="text-3xl font-bold text-slate-900">{documents.length}</div>
                <div className="text-sm text-slate-600">{t('activeDocuments')}</div>
              </div>
            </button>
            <button
              type="button"
              className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg cursor-pointer hover:shadow-lg hover:border-indigo-300 transition-all w-full text-left"
              onClick={() => setShowContributorsModal(true)}
              aria-label={`${displayedUsers.length} ${t('collaborators')}. ${language === 'he' ? 'לחץ לצפייה ברשימה מלאה' : 'Click to view full list'}`}
            >
              <div className="p-6 text-center">
                <Users className="w-8 h-8 mx-auto mb-3 text-indigo-600" aria-hidden="true" />
                <div className="text-3xl font-bold text-slate-900 flex items-center justify-center min-h-[2.25rem]">
                  {publicProfilesLoading ? (
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-400" aria-label={language === 'he' ? 'טוען...' : 'Loading...'} />
                  ) : (
                    displayedUsers.length
                  )}
                </div>
                <div className="text-sm text-slate-600">{t('collaborators')}</div>
              </div>
            </button>
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

      {/* Recent Groups */}
      <section id="recent-documents-section" className="max-w-7xl mx-auto px-6 py-16" aria-labelledby="groups-heading">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 id="groups-heading" className="text-3xl font-bold text-slate-900">
              {language === 'he' ? 'קבוצות פעילות' : language === 'ar' ? 'مجموعات نشطة' : 'Active Groups'}
            </h2>
            <p className="text-slate-600 mt-2">
              {language === 'he' ? 'הצטרפו לקבוצות ושתפו פעולה על מסמכים משותפים' : 'Join groups and collaborate on shared documents'}
            </p>
          </div>
        </div>

        {groupsLoading ? (
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
        ) : groups.length === 0 ? (
          <Card className="bg-white border-slate-200">
            <CardContent className="p-12 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                {language === 'he' ? 'אין קבוצות עדיין' : 'No groups yet'}
              </h3>
              <p className="text-slate-600 mb-4">
                {language === 'he' ? 'היו הראשונים ליצור קבוצה' : 'Be the first to create a group'}
              </p>
              {user && (
                <Link to={createPageUrl("CreateGroup")}>
                  <Button>{language === 'he' ? 'צור קבוצה' : 'Create Group'}</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.filter(group => {
              // Filter out hidden groups unless user is member, creator, or system admin
              if (group.status === 'hidden') {
                if (!user) return false;
                const isMember = groupMembers.some(m => m.groupId === group.id && m.userId === user.id);
                const isCreator = group.created_by === user.email;
                const isSystemAdmin = user.role === 'admin';
                return isMember || isCreator || isSystemAdmin;
              }
              return true;
            }).map((group) => {
              const groupDocs = documents.filter(d => d.groupId === group.id);
              const members = groupMembers.filter(m => m.groupId === group.id);
              const isAdmin = members.some(m => m.userId === user?.id && m.role === 'admin');

              const groupDocs = documents.filter(d => d.groupId === group.id);
              const members = groupMembers.filter(m => m.groupId === group.id);

              return (
                <Link 
                  key={group.id} 
                  to={`${createPageUrl("GroupView")}?id=${group.id}`}
                  aria-label={`${group.name}. ${group.status === 'private' ? (language === 'he' ? 'פרטי' : 'Private') : group.status === 'hidden' ? (language === 'he' ? 'חסוי' : 'Hidden') : (language === 'he' ? 'ציבורי' : 'Public')}. ${groupDocs.length} ${language === 'he' ? 'מסמכים' : 'documents'}, ${members.length} ${language === 'he' ? 'חברים' : 'members'}`}
                >
                  <Card className="bg-white border-slate-200 hover:shadow-lg hover:border-blue-300 transition-all duration-200 h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg break-words">{group.name}</CardTitle>
                        <div className="flex items-center gap-1 shrink-0">
                          {group.status === 'private' ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                              <Lock className="w-3 h-3 mr-1" />
                              {language === 'he' ? 'פרטי' : 'Private'}
                            </Badge>
                          ) : group.status === 'hidden' ? (
                            <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
                              <Lock className="w-3 h-3 mr-1" />
                              {language === 'he' ? 'חסוי' : 'Hidden'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <Globe className="w-3 h-3 mr-1" />
                              {language === 'he' ? 'ציבורי' : 'Public'}
                            </Badge>
                          )}
                          {isAdmin && (
                            <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                              {language === 'he' ? 'מנהל' : 'Admin'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {group.description && (
                        <p className="text-sm text-slate-600 mb-3 line-clamp-2">{group.description}</p>
                      )}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <FileText className="w-4 h-4" aria-hidden="true" />
                          <span>{documents.filter(d => d.groupId === group.id).length} {language === 'he' ? 'מסמכים' : 'documents'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Users className="w-4 h-4" aria-hidden="true" />
                          <span>{groupMembers.filter(m => m.groupId === group.id).length} {language === 'he' ? 'חברים' : 'members'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Clock className="w-4 h-4" aria-hidden="true" />
                          <span>{new Date(group.created_date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {/* Create New Group Button */}
        {user && groups.length > 0 && (
          <div className="flex justify-center mt-12">
            <Link to={createPageUrl("CreateGroup")}>
              <Button variant="outline" size="lg" className="border-blue-300 text-blue-700 hover:bg-blue-50">
                {language === 'he' ? 'צור קבוצה חדשה' : 'Create New Group'}
              </Button>
            </Link>
          </div>
        )}
      </section>

      <AllContributorsModal
        isOpen={showContributorsModal}
        onClose={() => setShowContributorsModal(false)}
        contributors={displayedUsers}
      />
    </div>
  );
}