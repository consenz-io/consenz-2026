import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Plus, AlertCircle, ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";
import VotesNeededCounter from "./VotesNeededCounter";
import SectionDiff from "./SectionDiff";
import CommentsSection from "./CommentsSection";

export default function DocumentContent({ 
  document, 
  topics, 
  sections, 
  suggestions,
  onEditSection, 
  onNewSection,
  isAdmin,
  user 
}) {
  const [showComments, setShowComments] = useState({});
  
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const getUserName = (email) => {
    const user = users.find(u => u.email === email);
    return user?.full_name || email;
  };

  const toggleComments = (id) => {
    setShowComments(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getSectionsForTopic = (topicId) => {
    return sections.filter(s => s.topicId === topicId).sort((a, b) => a.order - b.order);
  };

  const getSuggestionsForSection = (sectionId) => {
    return suggestions.filter(s => 
      s.sectionId === sectionId && 
      s.type === 'edit_section' && 
      s.status === 'pending'
    );
  };

  return (
    <div className="space-y-6">
      {topics.map((topic) => {
        const topicSections = getSectionsForTopic(topic.id);
        
        return (
          <Card key={topic.id} className="bg-white border-slate-200">
            <CardHeader className="border-b border-slate-100">
              <div className="flex justify-between items-center">
                <CardTitle className="text-2xl">{topic.title}</CardTitle>
                {user && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNewSection(topic.id)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Section
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {topicSections.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No sections yet. {user && "Click 'Add Section' to start."}
                </div>
              ) : (
                topicSections.map((section, index) => {
                  const sectionSuggestions = getSuggestionsForSection(section.id);
                  
                  return (
                    <div key={section.id} className="space-y-3">
                      <div className="group relative p-4 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-all">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-500 mb-2">
                              Section {index + 1}
                            </div>
                            <div 
                              className="prose prose-sm max-w-none text-slate-700"
                              dangerouslySetInnerHTML={{ __html: section.content }}
                            />
                            <div className="flex items-center justify-between mt-3">
                              <div className="text-xs text-slate-400">
                                Last edited {new Date(section.updated_date).toLocaleDateString()}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleComments(`section-${section.id}`)}
                                className="text-slate-600 hover:text-blue-600"
                              >
                                <MessageSquare className="w-4 h-4 mr-1" />
                                תגובות
                              </Button>
                            </div>
                          </div>
                          {user && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEditSection(section)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                        </div>

                        {showComments[`section-${section.id}`] && (
                          <div className="mt-4 pt-4 border-t border-slate-200">
                            <CommentsSection
                              entityType="section"
                              entityId={section.id}
                              user={user}
                            />
                          </div>
                        )}
                      </div>

                      {sectionSuggestions.length > 0 && (
                        <div className="space-y-3 ml-8">
                          {sectionSuggestions.map(suggestion => {
                            return (
                              <Card key={suggestion.id} className="bg-amber-50/50 border-amber-200">
                                <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                  <div className="flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-amber-600" />
                                    <span className="text-sm font-semibold text-amber-900">
                                      Pending Edit Suggestion
                                    </span>
                                  </div>
                                  <Link to={`${createPageUrl("SuggestionDetail")}?id=${suggestion.id}`}>
                                    <Button size="sm" variant="outline">
                                      View Details
                                    </Button>
                                  </Link>
                                </div>
                                
                                <div className="text-sm text-slate-700 mb-3">
                                  <strong>{suggestion.title}</strong>
                                  {suggestion.explanation && (
                                    <p className="text-slate-600 mt-1">{suggestion.explanation}</p>
                                  )}
                                </div>

                                <SectionDiff 
                                  originalContent={section.content}
                                  newContent={suggestion.newContent}
                                />

                                <div className="flex items-center gap-4 mt-3 text-sm flex-wrap">
                                  <div className="flex items-center gap-1 text-green-600">
                                    <ThumbsUp className="w-4 h-4" />
                                    <span className="font-medium">{suggestion.proVotes || 0}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-red-600">
                                    <ThumbsDown className="w-4 h-4" />
                                    <span className="font-medium">{suggestion.conVotes || 0}</span>
                                  </div>
                                  <VotesNeededCounter suggestion={suggestion} document={document} />
                                  <Badge variant="outline" className="text-xs">
                                    By {getUserName(suggestion.created_by)}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleComments(`suggestion-${suggestion.id}`)}
                                    className="mr-auto"
                                  >
                                    <MessageSquare className="w-4 h-4 mr-1" />
                                    תגובות
                                  </Button>
                                </div>

                                {showComments[`suggestion-${suggestion.id}`] && (
                                  <div className="mt-4 pt-4 border-t border-amber-300">
                                    <CommentsSection
                                      entityType="suggestion"
                                      entityId={suggestion.id}
                                      user={user}
                                    />
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        );
      })}

      {topics.length === 0 && (
        <Card className="bg-white border-slate-200">
          <CardContent className="p-12 text-center">
            <p className="text-slate-500">No topics defined yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}