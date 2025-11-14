import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Sparkles } from "lucide-react";

const POINTS_COST = 200;

export default function CreateSuggestionModal({ 
  document, 
  topics, 
  sections, 
  editingSection, 
  user, 
  onClose 
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);
  
  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 0,
    cacheTime: 0,
  });
  
  const isNewSection = editingSection?.isNew;
  const existingSection = !isNewSection ? sections.find(s => s.id === editingSection?.id) : null;

  const [formData, setFormData] = useState({
    title: isNewSection ? "" : `Edit: ${existingSection?.content?.substring(0, 30) || ''}...`,
    topicId: editingSection?.topicId || topics[0]?.id || "",
    newContent: existingSection?.content || "",
    explanation: "",
  });

  const createSuggestionMutation = useMutation({
    mutationFn: async (data) => {
      if (currentUser.points < POINTS_COST) {
        throw new Error(`You need at least ${POINTS_COST} points to create a suggestion`);
      }

      const timerEndsAt = new Date();
      timerEndsAt.setHours(timerEndsAt.getHours() + (document.defaultSuggestionLifetimeHours || 72));

      const suggestion = await base44.entities.Suggestion.create({
        documentId: document.id,
        sectionId: isNewSection ? null : editingSection.id,
        topicId: data.topicId,
        type: isNewSection ? 'new_section' : 'edit_section',
        title: data.title,
        newContent: data.newContent,
        explanation: data.explanation,
        status: 'pending',
        timerEndsAt: timerEndsAt.toISOString(),
        proVotes: 0,
        conVotes: 0,
        insertPosition: editingSection?.insertPosition,
      });

      await base44.auth.updateMe({
        points: currentUser.points - POINTS_COST,
        suggestionsCreated: (currentUser.suggestionsCreated || 0) + 1,
      });

      const interactions = await base44.entities.UserInteraction.filter({ 
        documentId: document.id, 
        userId: currentUser.id 
      });
      
      if (interactions.length === 0) {
        await base44.entities.UserInteraction.create({
          documentId: document.id,
          userId: currentUser.id,
          firstInteractionAt: new Date().toISOString(),
        });

        await base44.entities.Document.update(document.id, {
          totalUsersInteracted: (document.totalUsersInteracted || 0) + 1,
        });
      }

      return suggestion;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions', document.id] });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      queryClient.invalidateQueries({ queryKey: ['document', document.id] });
      onClose();
    },
    onError: (err) => {
      setError(err.message || "Failed to create suggestion");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }

    if (!formData.newContent.trim()) {
      setError("Content is required");
      return;
    }

    createSuggestionMutation.mutate(formData);
  };

  if (userLoading || !currentUser) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <div className="py-8 text-center">טוען...</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isNewSection ? 'Suggest New Section' : 'Suggest Edit to Section'}
          </DialogTitle>
          <div className="flex items-center gap-2 text-sm text-slate-600 mt-2">
            <Sparkles className="w-4 h-4" />
            <span>Cost: {POINTS_COST} points (You have: {currentUser.points || 0})</span>
          </div>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Suggestion Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Brief title for your suggestion"
            />
          </div>

          {isNewSection && (
            <div>
              <Label htmlFor="topic">Topic</Label>
              <Select
                value={formData.topicId}
                onValueChange={(value) => setFormData({ ...formData, topicId: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {topics.map((topic) => (
                    <SelectItem key={topic.id} value={topic.id}>
                      {topic.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="content">
              {isNewSection ? 'Section Content' : 'Proposed Changes'}
            </Label>
            <Textarea
              id="content"
              value={formData.newContent}
              onChange={(e) => setFormData({ ...formData, newContent: e.target.value })}
              placeholder="Enter the content..."
              rows={8}
            />
          </div>

          <div>
            <Label htmlFor="explanation">Explanation (Optional)</Label>
            <Textarea
              id="explanation"
              value={formData.explanation}
              onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
              placeholder="Explain why this change is needed..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createSuggestionMutation.isPending || currentUser.points < POINTS_COST}
              className="bg-gradient-to-r from-blue-600 to-indigo-600"
            >
              {createSuggestionMutation.isPending ? "Creating..." : "Create Suggestion"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}