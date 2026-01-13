import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Count active documents (public documents)
        const publicDocuments = await base44.asServiceRole.entities.Document.filter({
            privacy: { "$in": ["public_view_open_participation", "public_view_closed_participation"] }
        });
        const activeDocumentsCount = publicDocuments.length;

        // Count registered users
        const allUsers = await base44.asServiceRole.entities.User.list();
        const registeredUsersCount = allUsers.length;

        // Calculate average consensus
        const acceptedSuggestions = await base44.asServiceRole.entities.Suggestion.filter({ status: 'accepted' });
        let totalConsensusScore = 0;
        let validSuggestionsCount = 0;

        for (const s of acceptedSuggestions) {
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