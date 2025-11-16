import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { useLanguage } from "@/components/LanguageContext";

export default function DirectEditModal({ section, onClose }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [content, setContent] = useState(section.content);
  const [changeDescription, setChangeDescription] = useState("");

  const editMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      
      // Get the max version number for this section
      const existingVersions = await base44.entities.DocumentVersion.filter({
        documentId: section.documentId,
        sectionId: section.id
      });
      const maxVersion = existingVersions.length > 0 
        ? Math.max(...existingVersions.map(v => v.version)) 
        : 0;

      // Create version of current content
      await base44.entities.DocumentVersion.create({
        documentId: section.documentId,
        sectionId: section.id,
        content: section.content,
        version: maxVersion + 1,
        changeType: "direct_edit",
        changeDescription: changeDescription || "עריכה ישירה של אדמין"
      });

      // Update the section
      await base44.entities.Section.update(section.id, {
        content: content,
        lastEditedBy: user.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      queryClient.invalidateQueries({ queryKey: ['documentVersions'] });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('editSection')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{t('content')}</Label>
            <ReactQuill
              value={content}
              onChange={setContent}
              className="bg-white"
              theme="snow"
            />
          </div>
          <div>
            <Label>{t('changeDescription')}</Label>
            <Input
              value={changeDescription}
              onChange={(e) => setChangeDescription(e.target.value)}
              placeholder={t('explainChange')}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button
              onClick={() => editMutation.mutate()}
              disabled={editMutation.isPending || !content.trim()}
            >
              {editMutation.isPending ? t('saving') : t('saveChanges')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}