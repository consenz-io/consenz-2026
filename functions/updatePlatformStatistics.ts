import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Helper function to add delay
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        
        // Count active documents (documents in public groups OR public standalone documents)
        const allGroups = await base44.asServiceRole.entities.Group.list();
        await delay(200); // Small delay to avoid rate limit
        
        const publicGroups = allGroups.filter(g => g.status === 'public');
        const publicGroupIds = publicGroups.map(g => g.id);
        
        const allDocuments = await base44.asServiceRole.entities.Document.list();
        await delay(200);
        
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

        // Calculate average consensus from avgSuggestionConsensus of active documents
        let averageConsensus = 50; // Default 50%
        if (activeDocuments.length > 0) {
            const totalConsensus = activeDocuments.reduce((sum, d) => {
                const consensus = d.avgSuggestionConsensus !== undefined && d.avgSuggestionConsensus !== null 
                    ? d.avgSuggestionConsensus 
                    : 0.5; // Default to 0.5 (50%) if not set
                return sum + (consensus * 100);
            }, 0);
            averageConsensus = totalConsensus / activeDocuments.length;
        }

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