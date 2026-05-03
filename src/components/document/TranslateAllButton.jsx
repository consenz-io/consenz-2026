import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Languages, Loader2, Check, Eye, EyeOff } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { useDocumentTranslation } from "./TranslationContext";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const languagePrompts = {
  en: "English",
  he: "Hebrew",
  ar: "Arabic"
};

const detectLanguage = (text) => {
  if (!text) return 'en';
  const hebrewPattern = /[\u0590-\u05FF]/;
  const arabicPattern = /[\u0600-\u06FF]/;
  if (hebrewPattern.test(text)) return 'he';
  if (arabicPattern.test(text)) return 'ar';
  return 'en';
};

export default function TranslateAllButton({ document, topics, sections }) {
  const { t, language, isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const { globalShowTranslated, setGlobalShowTranslated, isTranslatingAll, setIsTranslatingAll, addTranslatedId } = useDocumentTranslation();
  const [progress, setProgress] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  // Check if any content has translations (no language detection needed)
  const hasAnyTranslations = 
    document.translations?.[language]?.title ||
    topics.some(t => t.translations?.[language]?.title) ||
    sections.some(s => s.translations?.[language]?.content);

  const translateAllMutation = useMutation({
    mutationFn: async () => {
      setIsTranslatingAll(true);
      setProgress(0);
      
      const items = [];
      
      // Check what needs translation (only on click)
      const documentNeedsTranslation = (document.originalLanguage || detectLanguage(document.title)) !== language;
      
      // Document title
      if (documentNeedsTranslation && !document.translations?.[language]?.title) {
        items.push({ type: 'document-title', entity: document });
      }
      
      // Document description
      if (documentNeedsTranslation && document.description && !document.translations?.[language]?.description) {
        items.push({ type: 'document-description', entity: document });
      }
      
      // Topics
      topics.forEach(topic => {
        const topicNeedsTranslation = (topic.originalLanguage || detectLanguage(topic.title)) !== language;
        if (topicNeedsTranslation && !topic.translations?.[language]?.title) {
          items.push({ type: 'topic', entity: topic });
        }
      });
      
      // Sections
      sections.forEach(section => {
        const sectionNeedsTranslation = (section.originalLanguage || detectLanguage(section.content)) !== language;
        if (sectionNeedsTranslation && !section.translations?.[language]?.content) {
          items.push({ type: 'section', entity: section });
        }
      });
      
      setTotalItems(items.length);
      
      // Translate in batches of 3 for better performance
      for (let i = 0; i < items.length; i += 3) {
        const batch = items.slice(i, i + 3);
        await Promise.all(batch.map(async (item) => {
          try {
            if (item.type === 'document-title') {
              const result = await base44.integrations.Core.InvokeLLM({
                prompt: `Translate the following text to ${languagePrompts[language]}. Return ONLY the translated text:\n${item.entity.title}`,
                add_context_from_internet: false,
              });
              const translatedTitle = (typeof result === 'string' ? result : result.content || result).trim();
              
              await base44.entities.Document.update(item.entity.id, {
                translations: {
                  ...(item.entity.translations || {}),
                  [language]: {
                    ...(item.entity.translations?.[language] || {}),
                    title: translatedTitle
                  }
                }
              });
              addTranslatedId(`doc-title-${item.entity.id}`);
            }
            
            if (item.type === 'document-description') {
              const result = await base44.integrations.Core.InvokeLLM({
                prompt: `Translate the following HTML text to ${languagePrompts[language]}. Return ONLY the translated HTML:\n${item.entity.description}`,
                add_context_from_internet: false,
              });
              const translatedDesc = (typeof result === 'string' ? result : result.content || result).trim();
              
              const currentDoc = await base44.entities.Document.filter({ id: item.entity.id }).then(d => d[0]);
              await base44.entities.Document.update(item.entity.id, {
                translations: {
                  ...(currentDoc?.translations || {}),
                  [language]: {
                    ...(currentDoc?.translations?.[language] || {}),
                    description: translatedDesc
                  }
                }
              });
              addTranslatedId(`doc-desc-${item.entity.id}`);
            }
            
            if (item.type === 'topic') {
              const result = await base44.integrations.Core.InvokeLLM({
                prompt: `Translate the following text to ${languagePrompts[language]}. Return ONLY the translated text:\n${item.entity.title}`,
                add_context_from_internet: false,
              });
              const translatedTitle = (typeof result === 'string' ? result : result.content || result).trim();
              
              await base44.entities.Topic.update(item.entity.id, {
                translations: {
                  ...(item.entity.translations || {}),
                  [language]: { title: translatedTitle }
                }
              });
              addTranslatedId(`topic-${item.entity.id}`);
            }
            
            if (item.type === 'section') {
              const result = await base44.integrations.Core.InvokeLLM({
                prompt: `Translate the following HTML content to ${languagePrompts[language]}. Keep ALL HTML tags exactly as they are. Return ONLY the translated HTML:\n${item.entity.content}`,
                add_context_from_internet: false,
              });
              let translatedContent = (typeof result === 'string' ? result : result.content || result).trim();
              translatedContent = translatedContent.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
              
              await base44.entities.Section.update(item.entity.id, {
                translations: {
                  ...(item.entity.translations || {}),
                  [language]: translatedContent
                }
              });
              addTranslatedId(`section-${item.entity.id}`);
            }
          } catch (err) {
            console.error(`Translation error for ${item.type}:`, err);
          }
        }));
        
        setProgress(Math.min(i + 3, items.length));
      }
      
      // Invalidate queries to refresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['document', document.id] }),
        queryClient.invalidateQueries({ queryKey: ['topics', document.id] }),
        queryClient.invalidateQueries({ queryKey: ['sections', document.id] }),
      ]);
      
      setGlobalShowTranslated(true);
    },
    onSettled: () => {
      setIsTranslatingAll(false);
      setProgress(0);
      setTotalItems(0);
    }
  });

  return null;
}