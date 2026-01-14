import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Count active documents (documents in public groups OR public standalone documents)
        const allGroups = await base44.asServiceRole.entities.Group.list();
        const publicGroups = allGroups.filter(g => g.status === 'public');
        const publicGroupIds = publicGroups.map(g => g.id);
        
        const allDocuments = await base44.asServiceRole.entities.Document.list();
        
        const activeDocuments = allDocuments.filter(doc => {
            // Include if in a public group
            if (doc.groupId && publicGroupIds.includes(doc.groupId)) {
                return true;
            }
            // Include if standalone and public
            if (!doc.groupId && (doc.privacy === 'public_view_open_participation' || doc.privacy === 'public_view_closed_participation')) {
                return true;
            }
            return false;
        });
        const activeDocumentsCount = activeDocuments.length;

        // Count registered users
        const allUsers = await base44.asServiceRole.entities.User.list();
        const registeredUsersCount = allUsers.length;

        // Calculate average consensus from accepted suggestions in active documents only
        const activeDocumentIds = activeDocuments.map(d => d.id);
        const acceptedSuggestions = await base44.asServiceRole.entities.Suggestion.filter({ status: 'accepted' });
        const relevantSuggestions = acceptedSuggestions.filter(s => activeDocumentIds.includes(s.documentId));
        
        let totalConsensusScore = 0;
        let validSuggestionsCount = 0;

        for (const s of relevantSuggestions) {
            if (typeof s.proVotes === 'number' && typeof s.conVotes === 'number') {
                const totalVotes = s.proVotes + s.conVotes;
                if (totalVotes > 0) {
                    totalConsensusScore += (s.proVotes / totalVotes);
                    validSuggestionsCount++;
                }
            }
        }
        const averageConsensus = validSuggestionsCount > 0 ? (totalConsensusScore / validSuggestionsCount) * 100 : 0;

        // Fetch or create the PlatformStatistics entity
        const existingStats = await base44.asServiceRole.entities.PlatformStatistics.list();
        const statsData = {
            activeDocumentsCount: activeDocumentsCount,
            registeredUsersCount: registeredUsersCount,
            averageConsensus: parseFloat(averageConsensus.toFixed(0)),
            lastUpdated: new Date().toISOString()
        };

        if (existingStats.length > 0) {
            await base44.asServiceRole.entities.PlatformStatistics.update(existingStats[0].id, statsData);
        } else {
            await base44.asServiceRole.entities.PlatformStatistics.create(statsData);
        }

        return Response.json({ status: "success", message: "Platform statistics updated successfully." });

    } catch (error) {
        console.error("Error updating platform statistics:", error);
        return Response.json({ status: "error", message: error.message }, { status: 500 });
    }
});