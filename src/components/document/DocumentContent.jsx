import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Plus } from "lucide-react";

export default function DocumentContent({ 
  document, 
  topics, 
  sections, 
  onEditSection, 
  onNewSection,
  isAdmin,
  user 
}) {
  const getSectionsForTopic = (topicId) => {
    return sections.filter(s => s.topicId === topicId).sort((a, b) => a.order - b.order);
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
                topicSections.map((section, index) => (
                  <div 
                    key={section.id} 
                    className="group relative p-4 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-all"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-500 mb-2">
                          Section {index + 1}
                        </div>
                        <div 
                          className="prose prose-sm max-w-none text-slate-700"
                          dangerouslySetInnerHTML={{ __html: section.content }}
                        />
                        <div className="text-xs text-slate-400 mt-3">
                          Last edited {new Date(section.updated_date).toLocaleDateString()}
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
                  </div>
                ))
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