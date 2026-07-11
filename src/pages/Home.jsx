import React, { useState } from "react";
import { useHomeData } from "@/components/home/useHomeData";
import HeroSection from "@/components/home/HeroSection";
import GroupsSection from "@/components/home/GroupsSection";
import RecentDocumentsSection from "@/components/home/RecentDocumentsSection";
import AllContributorsModal from "@/components/home/AllContributorsModal";

export default function Home() {
  const [showContributorsModal, setShowContributorsModal] = useState(false);

  const {
    user, groups, groupsLoading, groupMembers, membersLoading, documents,
    displayedUsers, publicProfilesLoading,
    averageConsensus, groupParticipantCounts, documentContributorCounts,
    contributorsList, totalUniqueContributors,
  } = useHomeData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <HeroSection
        documentsCount={documents.length}
        displayedUsers={displayedUsers}
        publicProfilesLoading={publicProfilesLoading}
        averageConsensus={averageConsensus}
        onContributorsClick={() => setShowContributorsModal(true)}
        contributorsCount={totalUniqueContributors}
      />

      <RecentDocumentsSection
        documents={documents}
        documentsLoading={groupsLoading || membersLoading}
        groups={groups}
        groupMembers={groupMembers}
        user={user}
        documentContributorCounts={documentContributorCounts}
      />

      <GroupsSection
        groups={groups}
        groupsLoading={groupsLoading || membersLoading}
        groupMembers={groupMembers}
        documents={documents}
        user={user}
        groupParticipantCounts={groupParticipantCounts}
      />

      <AllContributorsModal
        isOpen={showContributorsModal}
        onClose={() => setShowContributorsModal(false)}
        contributors={contributorsList}
      />
    </div>
  );
}