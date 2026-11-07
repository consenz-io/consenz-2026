import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toPreview } from "./stripHtmlText";

const uniq = (arr) => [...new Set(arr.filter(Boolean))];

async function listByIds(entity, ids) {
  if (!ids.length) return [];
  const res = await base44.entities[entity].filter({ id: { $in: ids } });
  return Array.isArray(res) ? res : res?.items || [];
}

const index = (records) =>
  records.reduce((acc, record) => {
    acc[record.id] = record;
    return acc;
  }, {});

// Resolves what each pending suggestion is actually attached to, so a reviewer
// knows which suggestion / section / document a translated comment belongs to.
async function loadContext(ids) {
  const [comments, suggestions, sections, versions, topics, documents] = await Promise.all([
    listByIds("Comment", ids.comment),
    listByIds("Suggestion", ids.suggestion),
    listByIds("Section", ids.section),
    listByIds("DocumentVersion", ids.version),
    listByIds("Topic", ids.topic),
    listByIds("Document", ids.document),
  ]);

  const rootSuggestionIds = [];
  const rootSectionIds = [];
  const rootDocumentIds = [];
  const argumentIds = [];
  comments.forEach((comment) => {
    if (comment.rootEntityType === "suggestion") rootSuggestionIds.push(comment.rootEntityId);
    else if (comment.rootEntityType === "section") rootSectionIds.push(comment.rootEntityId);
    else if (comment.rootEntityType === "document") rootDocumentIds.push(comment.rootEntityId);
    else if (comment.rootEntityType === "argument") argumentIds.push(comment.rootEntityId);
  });

  const argumentsList = await listByIds("Argument", uniq(argumentIds));
  const argumentSuggestionIds = argumentsList.map((argument) => argument.suggestionId);

  const extraSuggestionIds = uniq([...rootSuggestionIds, ...argumentSuggestionIds]);
  const extraSectionIds = uniq(rootSectionIds);
  const extraDocumentIds = uniq(rootDocumentIds);

  const [extraSuggestions, extraSections, extraDocuments] = await Promise.all([
    listByIds("Suggestion", extraSuggestionIds),
    listByIds("Section", extraSectionIds),
    listByIds("Document", extraDocumentIds),
  ]);

  const allSuggestions = [...suggestions, ...extraSuggestions];
  const allSections = [...sections, ...extraSections];
  const allDocuments = [...documents, ...extraDocuments];

  const topicIds = uniq([
    ...ids.topic,
    ...allSections.map((section) => section.topicId),
    ...versions.map((version) => version.topicId),
  ]);
  const allTopics = await listByIds(
    "Topic",
    topicIds.filter((id) => !topics.some((topic) => topic.id === id))
  ).then((loaded) => [...topics, ...loaded]);

  const documentIds = uniq([
    ...allDocuments.map((document) => document.id),
    ...allSections.map((section) => section.documentId),
    ...versions.map((version) => version.documentId),
    ...allSuggestions.map((suggestion) => suggestion.documentId),
    ...allTopics.map((topic) => topic.documentId),
  ]);
  const allDocumentTitles = await listByIds(
    "Document",
    documentIds.filter((id) => !allDocuments.some((document) => document.id === id))
  ).then((loaded) => [...allDocuments, ...loaded]);

  const suggestionById = index(allSuggestions);
  const sectionById = index(allSections);
  const topicById = index(allTopics);
  const documentById = index(allDocumentTitles);
  const argumentById = index(argumentsList);

  const documentUrl = (documentId) => (documentId ? `/DocumentView?id=${documentId}` : null);
  const sectionUrl = (documentId, sectionId) => {
    if (!documentId) return null;
    return sectionId
      ? `/DocumentView?id=${documentId}&scrollTo=section-${sectionId}`
      : `/DocumentView?id=${documentId}`;
  };
  // The suggestion page opens its comment thread and scrolls to the comment.
  const suggestionUrl = (id, commentId) =>
    id ? `/suggestiondetail?id=${id}${commentId ? `&commentId=${commentId}` : ""}` : null;
  // A section comment lives inside a collapsed thread on the document page, so
  // the link opens that thread and scrolls to the exact comment.
  const sectionCommentUrl = (documentId, sectionId, commentId) => {
    if (!documentId || !sectionId) return documentUrl(documentId);
    return `/DocumentView?id=${documentId}&scrollTo=section-${sectionId}&openSectionComments=${sectionId}&sectionCommentId=${commentId}`;
  };

  const context = {};

  comments.forEach((comment) => {
    let entry = null;
    if (comment.rootEntityType === "suggestion") {
      const suggestion = suggestionById[comment.rootEntityId];
      entry = {
        source: "comment",
        targetKind: "suggestion",
        title: suggestion?.title || null,
        url: suggestionUrl(comment.rootEntityId, comment.id),
      };
    } else if (comment.rootEntityType === "argument") {
      const argument = argumentById[comment.rootEntityId];
      const suggestion = argument ? suggestionById[argument.suggestionId] : null;
      entry = {
        source: "comment",
        targetKind: "argument",
        title: suggestion?.title || null,
        url: suggestion ? suggestionUrl(suggestion.id, comment.id) : null,
      };
    } else if (comment.rootEntityType === "section") {
      const section = sectionById[comment.rootEntityId];
      const topic = section ? topicById[section.topicId] : null;
      entry = {
        source: "comment",
        targetKind: "section",
        title: topic?.title || null,
        titleKind: "topic",
        quote: toPreview(section?.content),
        url: sectionCommentUrl(section?.documentId, section?.id, comment.id),
      };
    } else if (comment.rootEntityType === "document") {
      const document = documentById[comment.rootEntityId];
      entry = {
        source: "comment",
        targetKind: "document",
        title: document?.title || null,
        url: comment.rootEntityId
          ? `/DocumentView?id=${comment.rootEntityId}&commentId=${comment.id}`
          : null,
      };
    }
    if (entry) context[`comment:${comment.id}`] = entry;
  });

  allSuggestions.forEach((suggestion) => {
    context[`suggestion:${suggestion.id}`] = {
      source: "content",
      targetKind: "suggestion",
      title: suggestion.title || null,
      quote: toPreview(suggestion.newContent || suggestion.explanation),
      url: suggestionUrl(suggestion.id),
    };
  });

  allSections.forEach((section) => {
    const topic = topicById[section.topicId];
    const document = documentById[section.documentId];
    context[`section:${section.id}`] = {
      source: "content",
      targetKind: "section",
      title: topic?.title || null,
      titleKind: "topic",
      subtitle: document?.title || null,
      quote: toPreview(section.content),
      url: sectionUrl(section.documentId, section.id),
    };
  });

  versions.forEach((version) => {
    const topic = topicById[version.topicId];
    const document = documentById[version.documentId];
    context[`version:${version.id}`] = {
      source: "content",
      targetKind: "version",
      title: topic?.title || null,
      titleKind: "topic",
      subtitle: document?.title || null,
      quote: toPreview(version.content),
      url: sectionUrl(version.documentId, version.sectionId),
    };
  });

  allTopics.forEach((topic) => {
    const document = documentById[topic.documentId];
    context[`topic:${topic.id}`] = {
      source: "content",
      targetKind: "topic",
      title: topic.title || null,
      titleKind: "topic",
      subtitle: document?.title || null,
      url: documentUrl(topic.documentId),
    };
  });

  allDocumentTitles.forEach((document) => {
    context[`document:${document.id}`] = {
      source: "content",
      targetKind: "document",
      title: document.title || null,
      url: documentUrl(document.id),
    };
  });

  return context;
}

export function useTranslationSuggestionContext(suggestions = []) {
  const buckets = { comment: [], suggestion: [], section: [], version: [], topic: [], document: [] };
  suggestions.forEach((suggestion) => {
    if (suggestion.scope !== "content") return;
    const bucket = buckets[suggestion.sourceEntityType];
    if (bucket && suggestion.sourceEntityId) bucket.push(suggestion.sourceEntityId);
  });

  const ids = Object.fromEntries(
    Object.entries(buckets).map(([type, list]) => [type, uniq(list).sort()])
  );
  const enabled = Object.values(ids).some((list) => list.length > 0);

  const { data } = useQuery({
    queryKey: ["translationSuggestionContext", ids],
    queryFn: () => loadContext(ids),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  return data || {};
}

export function contextKey(suggestion) {
  return suggestion?.sourceEntityId
    ? `${suggestion.sourceEntityType}:${suggestion.sourceEntityId}`
    : null;
}