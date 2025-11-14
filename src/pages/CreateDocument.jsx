import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Plus, Trash2, AlertCircle } from "lucide-react";

export default function CreateDocument() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    urlName: "",
    privacy: "public_view_open_participation",
    votingButtonsEnabled: true,
    defaultSuggestionLifetimeHours: 72,
  });

  const [topics, setTopics] = useState([{ title: "", sections: [{ content: "" }] }]);

  const createDocMutation = useMutation({
    mutationFn: async (data) => {
      const doc = await base44.entities.Document.create({
        title: data.title,
        urlName: data.urlName,
        privacy: data.privacy,
        votingButtonsEnabled: data.votingButtonsEnabled,
        defaultSuggestionLifetimeHours: data.defaultSuggestionLifetimeHours,
      });

      const user = await base44.auth.me();
      await base44.entities.DocumentAdmin.create({
        documentId: doc.id,
        userId: user.id,
      });

      for (let i = 0; i < data.topics.length; i++) {
        const topicData = data.topics[i];
        if (!topicData.title.trim()) continue;

        const topic = await base44.entities.Topic.create({
          documentId: doc.id,
          title: topicData.title,
          order: i,
        });

        for (let j = 0; j < topicData.sections.length; j++) {
          const sectionContent = topicData.sections[j].content;
          if (!sectionContent.trim()) continue;

          await base44.entities.Section.create({
            documentId: doc.id,
            topicId: topic.id,
            content: sectionContent,
            order: j,
            lastEditedBy: user.id,
          });
        }
      }

      return doc;
    },
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: ['publicDocuments'] });
      navigate(createPageUrl("DocumentView", `?id=${doc.id}`));
    },
    onError: (err) => {
      setError(err.message || "Failed to create document");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }

    if (!formData.urlName.trim()) {
      setError("URL name is required");
      return;
    }

    createDocMutation.mutate({ ...formData, topics });
  };

  const addTopic = () => {
    setTopics([...topics, { title: "", sections: [{ content: "" }] }]);
  };

  const removeTopic = (index) => {
    setTopics(topics.filter((_, i) => i !== index));
  };

  const addSection = (topicIndex) => {
    const newTopics = [...topics];
    newTopics[topicIndex].sections.push({ content: "" });
    setTopics(newTopics);
  };

  const removeSection = (topicIndex, sectionIndex) => {
    const newTopics = [...topics];
    newTopics[topicIndex].sections = newTopics[topicIndex].sections.filter((_, i) => i !== sectionIndex);
    setTopics(newTopics);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Create New Document</h1>
          <p className="text-slate-600 mt-2">Start a new collaborative drafting process</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Document Details</CardTitle>
              <CardDescription>Basic information about your document</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Document Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Community Constitution"
                />
              </div>

              <div>
                <Label htmlFor="urlName">URL Name</Label>
                <Input
                  id="urlName"
                  value={formData.urlName}
                  onChange={(e) => setFormData({ ...formData, urlName: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  placeholder="e.g., community-constitution"
                />
                <p className="text-sm text-slate-500 mt-1">Used in the document URL</p>
              </div>

              <div>
                <Label htmlFor="privacy">Privacy Setting</Label>
                <Select
                  value={formData.privacy}
                  onValueChange={(value) => setFormData({ ...formData, privacy: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public_view_open_participation">Public - Open Participation</SelectItem>
                    <SelectItem value="public_view_closed_participation">Public View - Closed Participation</SelectItem>
                    <SelectItem value="private_invite_only">Private - Invite Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="voting">Enable Voting Buttons</Label>
                <Switch
                  id="voting"
                  checked={formData.votingButtonsEnabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, votingButtonsEnabled: checked })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Topics & Sections</CardTitle>
                  <CardDescription>Structure your document with topics and sections</CardDescription>
                </div>
                <Button type="button" onClick={addTopic} variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Topic
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {topics.map((topic, topicIndex) => (
                <div key={topicIndex} className="border border-slate-200 rounded-lg p-4 space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={topic.title}
                      onChange={(e) => {
                        const newTopics = [...topics];
                        newTopics[topicIndex].title = e.target.value;
                        setTopics(newTopics);
                      }}
                      placeholder="Topic title"
                      className="flex-1"
                    />
                    {topics.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTopic(topicIndex)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </div>

                  {topic.sections.map((section, sectionIndex) => (
                    <div key={sectionIndex} className="flex gap-2 items-start pl-4">
                      <Textarea
                        value={section.content}
                        onChange={(e) => {
                          const newTopics = [...topics];
                          newTopics[topicIndex].sections[sectionIndex].content = e.target.value;
                          setTopics(newTopics);
                        }}
                        placeholder="Section content"
                        className="flex-1"
                        rows={3}
                      />
                      {topic.sections.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSection(topicIndex, sectionIndex)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  ))}

                  <Button
                    type="button"
                    onClick={() => addSection(topicIndex)}
                    variant="outline"
                    size="sm"
                    className="ml-4"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Section
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(createPageUrl("Home"))}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createDocMutation.isPending}
              className="bg-gradient-to-r from-blue-600 to-indigo-600"
            >
              <FileText className="w-4 h-4 mr-2" />
              {createDocMutation.isPending ? "Creating..." : "Create Document"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}