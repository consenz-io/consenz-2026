import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ArrowLeft, ThumbsUp, ThumbsDown, MessageSquare, Clock, 
  CheckCircle, XCircle, AlertCircle, Loader2, Trash2 
} from "lucide-react";
import VotesNeededCounter from "../components/document/VotesNeededCounter";
import { Skeleton } from "@/components/ui/skeleton";
import CommentsSection from "../components/document/CommentsSection";

export default function SuggestionDetail() {
  const [searchParams] = useSearchParams();
  const suggestionId = searchParams.get('id');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newArgument, setNewArgument] = useState({ type: null, content: "" });
  const [error, setError] = useState(null);

  const { data: suggestion, isLoading: suggestionLoading } = useQuery({
    queryKey: ['suggestion', suggestionId],
    queryFn: () => base44.entities.Suggestion.filter({ id: suggestionId }).then(s => s[0]),
    enabled: !!suggestionId,
    refetchInterval: 3000, // רענון כל 3 שניות
  });

  const { data: document } = useQuery({
    queryKey: ['document', suggestion?.documentId],
    queryFn: () => base44.entities.Document.filter({ id: suggestion.documentId }).then(d => d[0]),
    enabled: !!suggestion?.documentId,
  });

  const { data: section } = useQuery({
    queryKey: ['section', suggestion?.sectionId],
    queryFn: () => base44.entities.Section.filter({ id: suggestion.sectionId }).then(s => s[0]),
    enabled: !!suggestion?.sectionId,
  });

  const { data: topic } = useQuery({
    queryKey: ['topic', suggestion?.topicId],
    queryFn: () => base44.entities.Topic.filter({ id: suggestion.topicId }).then(t => t[0]),
    enabled: !!suggestion?.topicId,
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: isAdmin } = useQuery({
    queryKey: ['isAdmin', document?.id, user?.id],
    queryFn: async () => {
      if (!user?.id || !document?.id) return false;
      const admins = await base44.entities.DocumentAdmin.filter({ 
        documentId: document.id, 
        userId: user.id 
      });
      return admins.length > 0;
    },
    enabled: !!user?.id && !!document?.id,
  });

  const { data: userVote } = useQuery({
    queryKey: ['userVote', suggestionId, user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const votes = await base44.entities.Vote.filter({ 
        suggestionId, 
        userId: user.id 
      });
      return votes.length > 0 ? votes[0] : null;
    },
    enabled: !!suggestionId && !!user?.id,
  });

  const { data: args, isLoading: argsLoading } = useQuery({
    queryKey: ['arguments', suggestionId],
    queryFn: () => base44.entities.Argument.filter({ suggestionId }, '-created_date'),
    initialData: [],
    enabled: !!suggestionId,
  });

  const { data: comments } = useQuery({
    queryKey: ['comments', suggestionId],
    queryFn: () => base44.entities.Comment.filter({ 
      rootEntityType: 'suggestion',
      rootEntityId: suggestionId 
    }, '-created_date'),
    initialData: [],
    enabled: !!suggestionId,
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const getUserName = (email) => {
    const user = users.find(u => u.email === email);
    return user?.full_name || email;
  };

  const voteMutation = useMutation({
    mutationFn: async (vote) => {
      if (!user) throw new Error("Must be logged in to vote");

      if (userVote) {
        if (userVote.vote === vote) {
          await base44.entities.Vote.delete(userVote.id);
          await base44.entities.Suggestion.update(suggestionId, {
            [vote === 'pro' ? 'proVotes' : 'conVotes']: Math.max(0, (suggestion[vote === 'pro' ? 'proVotes' : 'conVotes'] || 0) - 1)
          });
        } else {
          await base44.entities.Vote.update(userVote.id, { vote });
          await base44.entities.Suggestion.update(suggestionId, {
            proVotes: suggestion.proVotes + (vote === 'pro' ? 1 : -1),
            conVotes: suggestion.conVotes + (vote === 'con' ? 1 : -1)
          });
        }
      } else {
        await base44.entities.Vote.create({
          suggestionId,
          userId: user.id,
          vote
        });
        await base44.entities.Suggestion.update(suggestionId, {
          [vote === 'pro' ? 'proVotes' : 'conVotes']: (suggestion[vote === 'pro' ? 'proVotes' : 'conVotes'] || 0) + 1
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestion', suggestionId] });
      queryClient.invalidateQueries({ queryKey: ['userVote', suggestionId] });
    },
    onError: (err) => {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    }
  });

  const addArgumentMutation = useMutation({
    mutationFn: async ({ type, content }) => {
      if (!user) throw new Error("Must be logged in");
      if (!content.trim()) throw new Error("Argument content is required");

      await base44.entities.Argument.create({
        suggestionId,
        type,
        content: content.trim(),
        convincedCount: 0
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['arguments', suggestionId] });
      setNewArgument({ type: null, content: "" });
    },
    onError: (err) => {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status) => {
      if (!isAdmin) throw new Error("Admin access required");
      
      if (status === 'accepted' && suggestion.type === 'edit_section' && section) {
        // Get existing versions to calculate next version number
        const versions = await base44.entities.DocumentVersion.filter({ sectionId: section.id });
        const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version)) + 1 : 1;
        
        // Save version with OLD content before updating
        await base44.entities.DocumentVersion.create({
          documentId: suggestion.documentId,
          sectionId: section.id,
          content: section.content,
          changeDescription: `לפני: ${suggestion.title}`,
          version: nextVersion,
          changeType: 'suggestion_accepted',
          suggestionId: suggestion.id
        });
        
        // Update section with new content
        await base44.entities.Section.update(section.id, {
          content: suggestion.newContent,
          lastEditedBy: user.id
        });
        
        // Save version with NEW content after updating
        await base44.entities.DocumentVersion.create({
          documentId: suggestion.documentId,
          sectionId: section.id,
          content: suggestion.newContent,
          changeDescription: suggestion.title,
          version: nextVersion + 1,
          changeType: 'suggestion_accepted',
          suggestionId: suggestion.id
        });
      } else if (status === 'accepted' && suggestion.type === 'new_section') {
        const sections = await base44.entities.Section.filter({ 
          documentId: suggestion.documentId,
          topicId: suggestion.topicId 
        }, 'order');
        
        let newOrder;
        if (suggestion.insertPosition !== undefined && suggestion.insertPosition !== null) {
          // Insert at specific position - update orders of sections after this position
          const sectionsToUpdate = sections.filter(s => s.order >= suggestion.insertPosition);
          for (const section of sectionsToUpdate) {
            await base44.entities.Section.update(section.id, { order: section.order + 1 });
          }
          newOrder = suggestion.insertPosition;
        } else {
          // Insert at end
          const maxOrder = sections.length > 0 ? Math.max(...sections.map(s => s.order)) : -1;
          newOrder = maxOrder + 1;
        }
        
        const newSection = await base44.entities.Section.create({
          documentId: suggestion.documentId,
          topicId: suggestion.topicId,
          content: suggestion.newContent,
          order: newOrder,
          lastEditedBy: user.id
        });
        
        // Create initial version for new section
        await base44.entities.DocumentVersion.create({
          documentId: suggestion.documentId,
          sectionId: newSection.id,
          content: suggestion.newContent,
          changeDescription: suggestion.title,
          version: 1,
          changeType: 'section_created',
          suggestionId: suggestion.id
        });
      }

      await base44.entities.Suggestion.update(suggestionId, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestion', suggestionId] });
      queryClient.invalidateQueries({ queryKey: ['sections', document?.id] });
      queryClient.invalidateQueries({ queryKey: ['versions'] });
    },
    onError: (err) => {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    }
  });

  const deleteSuggestionMutation = useMutation({
    mutationFn: async () => {
      if (!user || user.email !== suggestion.created_by) {
        throw new Error("Only the creator can delete this suggestion");
      }
      await base44.entities.Suggestion.delete(suggestionId);
    },
    onSuccess: () => {
      navigate(`${createPageUrl("DocumentView")}?id=${suggestion.documentId}`);
    },
    onError: (err) => {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    }
  });

  if (suggestionLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!suggestion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-5xl mx-auto text-center py-20">
          <h1 className="text-2xl font-bold text-slate-900">Suggestion not found</h1>
          <Button className="mt-4" onClick={() => navigate(createPageUrl("Home"))}>
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'accepted': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getTimeRemaining = (timerEndsAt) => {
    if (!timerEndsAt) return null;
    const now = new Date();
    const end = new Date(timerEndsAt);
    const diff = end - now;
    
    if (diff <= 0) return 'Voting ended';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h remaining`;
    return `${hours}h remaining`;
  };

  const proArgs = args.filter(a => a.type === 'pro');
  const conArgs = args.filter(a => a.type === 'con');
  const consensusScore = suggestion.proVotes + suggestion.conVotes > 0 
    ? (suggestion.proVotes / (suggestion.proVotes + suggestion.conVotes) * 100).toFixed(0)
    : 50;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to={`${createPageUrl("DocumentView")}?id=${suggestion.documentId}`}>
              <Button variant="outline" size="icon">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{suggestion.title}</h1>
              {document && (
                <p className="text-slate-600 mt-1">
                  <Link to={`${createPageUrl("DocumentView")}?id=${document.id}`} className="hover:underline">
                    {document.title}
                  </Link>
                </p>
              )}
            </div>
          </div>
          {user && user.email === suggestion.created_by && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm('האם אתה בטוח שברצונך למחוק הצעה זו?')) {
                  deleteSuggestionMutation.mutate();
                }
              }}
              disabled={deleteSuggestionMutation.isPending}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              מחק הצעה
            </Button>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="bg-white border-slate-200">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={getStatusColor(suggestion.status)}>
                  {suggestion.status}
                </Badge>
                <Badge variant="outline">
                  {suggestion.type === 'new_section' ? 'New Section' : 'Edit Section'}
                </Badge>
                {topic && <Badge variant="outline">{topic.title}</Badge>}
              </div>
              {suggestion.status === 'pending' && suggestion.timerEndsAt && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {getTimeRemaining(suggestion.timerEndsAt)}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Proposed Content</h3>
              <div 
                className="prose prose-sm max-w-none p-4 bg-blue-50 border border-blue-200 rounded-lg"
                dangerouslySetInnerHTML={{ __html: suggestion.newContent }}
              />
            </div>

            {suggestion.explanation && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Explanation</h3>
                <p className="text-slate-600">{suggestion.explanation}</p>
              </div>
            )}

            {section && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Current Content</h3>
                <div 
                  className="prose prose-sm max-w-none p-4 bg-slate-50 border border-slate-200 rounded-lg"
                  dangerouslySetInnerHTML={{ __html: section.content }}
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex gap-6 flex-wrap items-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{suggestion.proVotes || 0}</div>
                  <div className="text-xs text-slate-500">Pro Votes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{suggestion.conVotes || 0}</div>
                  <div className="text-xs text-slate-500">Con Votes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{consensusScore}%</div>
                  <div className="text-xs text-slate-500">Consensus</div>
                </div>
                <VotesNeededCounter suggestion={suggestion} document={document} />
              </div>

              {user && suggestion.status === 'pending' && document?.votingButtonsEnabled && (
                <div className="flex gap-2">
                  <Button
                    variant={userVote?.vote === 'pro' ? 'default' : 'outline'}
                    onClick={() => voteMutation.mutate('pro')}
                    disabled={voteMutation.isPending}
                    className={userVote?.vote === 'pro' ? 'bg-green-600 hover:bg-green-700' : ''}
                  >
                    <ThumbsUp className="w-4 h-4 mr-2" />
                    Vote Pro
                  </Button>
                  <Button
                    variant={userVote?.vote === 'con' ? 'default' : 'outline'}
                    onClick={() => voteMutation.mutate('con')}
                    disabled={voteMutation.isPending}
                    className={userVote?.vote === 'con' ? 'bg-red-600 hover:bg-red-700' : ''}
                  >
                    <ThumbsDown className="w-4 h-4 mr-2" />
                    Vote Con
                  </Button>
                </div>
              )}
            </div>

            {isAdmin && suggestion.status === 'pending' && (
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={() => updateStatusMutation.mutate('accepted')}
                  disabled={updateStatusMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Accept Suggestion
                </Button>
                <Button
                  onClick={() => updateStatusMutation.mutate('rejected')}
                  disabled={updateStatusMutation.isPending}
                  variant="destructive"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject Suggestion
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-white border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <ThumbsUp className="w-5 h-5" />
                Pro Arguments ({proArgs.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {proArgs.length === 0 ? (
                <p className="text-sm text-slate-500">No pro arguments yet</p>
              ) : (
                proArgs.map(arg => (
                  <div key={arg.id} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-slate-700">{arg.content}</p>
                    <div className="text-xs text-slate-500 mt-2">
                      By {getUserName(arg.created_by)} • {new Date(arg.created_date).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
              {user && newArgument.type !== 'pro' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewArgument({ type: 'pro', content: "" })}
                  className="w-full"
                >
                  Add Pro Argument
                </Button>
              )}
              {newArgument.type === 'pro' && (
                <div className="space-y-2">
                  <Textarea
                    value={newArgument.content}
                    onChange={(e) => setNewArgument({ ...newArgument, content: e.target.value })}
                    placeholder="Write your pro argument..."
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => addArgumentMutation.mutate(newArgument)}
                      disabled={addArgumentMutation.isPending || !newArgument.content.trim()}
                    >
                      Submit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setNewArgument({ type: null, content: "" })}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <ThumbsDown className="w-5 h-5" />
                Con Arguments ({conArgs.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {conArgs.length === 0 ? (
                <p className="text-sm text-slate-500">No con arguments yet</p>
              ) : (
                conArgs.map(arg => (
                  <div key={arg.id} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-slate-700">{arg.content}</p>
                    <div className="text-xs text-slate-500 mt-2">
                      By {getUserName(arg.created_by)} • {new Date(arg.created_date).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
              {user && newArgument.type !== 'con' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewArgument({ type: 'con', content: "" })}
                  className="w-full"
                >
                  Add Con Argument
                </Button>
              )}
              {newArgument.type === 'con' && (
                <div className="space-y-2">
                  <Textarea
                    value={newArgument.content}
                    onChange={(e) => setNewArgument({ ...newArgument, content: e.target.value })}
                    placeholder="Write your con argument..."
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => addArgumentMutation.mutate(newArgument)}
                      disabled={addArgumentMutation.isPending || !newArgument.content.trim()}
                    >
                      Submit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setNewArgument({ type: null, content: "" })}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle>תגובות על ההצעה</CardTitle>
          </CardHeader>
          <CardContent>
            <CommentsSection
              entityType="suggestion"
              entityId={suggestionId}
              user={user}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}