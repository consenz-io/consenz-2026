import React, { useState } from "react";
import { useHomeData } from "@/components/home/useHomeData";
import HeroSection from "@/components/home/HeroSection";
import GroupsSection from "@/components/home/GroupsSection";
import AllContributorsModal from "@/components/home/AllContributorsModal";

export default function Home() {
  const [showContributorsModal, setShowContributorsModal] = useState(false);

  const {
    user, groups, groupsLoading, groupMembers, membersLoading, documents,
    displayedUsers, publicProfilesLoading,
    averageConsensus, groupParticipantCounts,
    contributorsList,
  } = useHomeData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <HeroSection
        documentsCount={documents.length}
        displayedUsers={displayedUsers}
        publicProfilesLoading={publicProfilesLoading}
        averageConsensus={averageConsensus}
        onContributorsClick={() => setShowContributorsModal(true)}
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