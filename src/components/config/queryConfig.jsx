// Centralized React Query configuration for optimal caching

export const QUERY_STALE_TIMES = {
  // Static data - rarely changes
  USER_PROFILE: 5 * 60 * 1000, // 5 minutes
  PUBLIC_PROFILES: 5 * 60 * 1000, // 5 minutes
  GROUPS: 3 * 60 * 1000, // 3 minutes
  
  // Semi-static data
  DOCUMENT_METADATA: 2 * 60 * 1000, // 2 minutes (title, description, settings)
  TOPICS: 1 * 60 * 1000, // 1 minute
  
  // Dynamic data - changes frequently
  SECTIONS: 30 * 1000, // 30 seconds
  SUGGESTIONS: 15 * 1000, // 15 seconds
  VOTES: 10 * 1000, // 10 seconds
  COMMENTS: 20 * 1000, // 20 seconds
  ARGUMENTS: 20 * 1000, // 20 seconds
  NOTIFICATIONS: 30 * 1000, // 30 seconds
  
  // Real-time data - always fresh
  CURRENT_USER: 0, // Always fresh
  VERSIONS: 0, // Always fresh
};

export const QUERY_CACHE_TIMES = {
  DEFAULT: 10 * 60 * 1000, // 10 minutes
  STATIC: 30 * 60 * 1000, // 30 minutes for static data
  DYNAMIC: 5 * 60 * 1000, // 5 minutes for dynamic data
};

export const defaultQueryConfig = {
  queries: {
    staleTime: 30 * 1000,
    cacheTime: QUERY_CACHE_TIMES.DEFAULT,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 1,
  },
  mutations: {
    retry: 0,
  },
};

export const queryKeys = {
  currentUser: ['currentUser'],
  userProfile: (userId) => ['userProfile', userId],
  publicProfiles: ['publicProfiles'],
  
  document: (documentId) => ['document', documentId],
  documents: () => ['documents'],
  documentMetadata: (documentId) => ['documentMetadata', documentId],
  
  topics: (documentId) => ['topics', documentId],
  sections: (documentId) => ['sections', documentId],
  
  suggestions: (documentId) => ['suggestions', documentId],
  allSuggestions: () => ['allSuggestions'],
  suggestion: (suggestionId) => ['suggestion', suggestionId],
  votes: (suggestionId) => suggestionId ? ['votes', suggestionId] : ['allVotes'],
  arguments: (suggestionId) => suggestionId ? ['arguments', suggestionId] : ['allArguments'],
  comments: (entityType, entityId) => ['comments', entityType, entityId],
  allComments: () => ['allComments'],
  
  notifications: (userId) => ['notifications', userId],
  
  group: (groupId) => ['group', groupId],
  groups: () => ['groups'],
  groupMembers: (groupId) => ['groupMembers', groupId],
  userGroupMemberships: (userId) => ['userGroupMemberships', userId],
  
  versions: (documentId) => ['versions', documentId],
  sectionVersions: (sectionId) => ['sectionVersions', sectionId],
  
  userSuggestions: (userEmail) => ['userSuggestions', userEmail],
  userVotes: (userId) => ['userProVotes', userId],
  documentAdmins: (documentId) => ['documentAdmins', documentId],
};

export const invalidateQueries = {
  document: (queryClient, documentId) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.document(documentId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.documentMetadata(documentId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.documents() });
  },

  suggestion: (queryClient, documentId, suggestionId) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.suggestions(documentId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.allSuggestions() });
    if (suggestionId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.suggestion(suggestionId) });
    }
  },

  sections: (queryClient, documentId) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.sections(documentId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.versions(documentId) });
  },

  votes: (queryClient, suggestionId) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.votes(suggestionId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.votes() });
  },

  userProfile: (queryClient, userId) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.userProfile(userId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.publicProfiles });
    queryClient.invalidateQueries({ queryKey: queryKeys.currentUser });
  },
};