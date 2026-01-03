import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { email } = await req.json();

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    // Get user by email
    const users = await base44.asServiceRole.entities.User.filter({ email });
    if (users.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }
    const user = users[0];

    // Create sample digest entries for testing
    const testDigests = [
      {
        userId: user.id,
        notificationType: 'new_suggestion_in_followed_document',
        title: 'הצעה חדשה במסמך',
        message: 'משתמש חדש הוסיף הצעה למסמך "חוקת הקהילה"',
        actionUrl: 'https://consenz.io/document/test',
        relatedEntityType: 'suggestion',
        relatedEntityId: 'test-1',
        isIncludedInDigest: false,
        documentId: 'doc-1',
        documentTitle: 'חוקת הקהילה'
      },
      {
        userId: user.id,
        notificationType: 'new_vote_on_suggestion',
        title: 'הצבעה חדשה על ההצעה שלך',
        message: 'דני הצביע בעד ההצעה שלך "הוספת סעיף חדש"',
        actionUrl: 'https://consenz.io/suggestion/test-2',
        relatedEntityType: 'suggestion',
        relatedEntityId: 'test-2',
        isIncludedInDigest: false,
        documentId: 'doc-1',
        documentTitle: 'חוקת הקהילה'
      },
      {
        userId: user.id,
        notificationType: 'reply_to_my_comment',
        title: 'תשובה לתגובה שלך',
        message: 'שרה השיבה לתגובה שלך בדיון',
        actionUrl: 'https://consenz.io/comment/test-3',
        relatedEntityType: 'comment',
        relatedEntityId: 'test-3',
        isIncludedInDigest: false,
        documentId: 'doc-2',
        documentTitle: 'מדיניות פרטיות'
      },
      {
        userId: user.id,
        notificationType: 'suggestion_status_changed',
        title: 'הצעה התקבלה',
        message: 'ההצעה שלך "שינוי בסעיף 3" התקבלה ונוספה למסמך',
        actionUrl: 'https://consenz.io/suggestion/test-4',
        relatedEntityType: 'suggestion',
        relatedEntityId: 'test-4',
        isIncludedInDigest: false,
        documentId: 'doc-1',
        documentTitle: 'חוקת הקהילה'
      },
      {
        userId: user.id,
        notificationType: 'new_suggestion_in_followed_document',
        title: 'הצעה נוספת במסמך',
        message: 'יעל הציעה עריכה לסעיף 5',
        actionUrl: 'https://consenz.io/document/test',
        relatedEntityType: 'suggestion',
        relatedEntityId: 'test-5',
        isIncludedInDigest: false,
        documentId: 'doc-2',
        documentTitle: 'מדיניות פרטיות'
      }
    ];

    // Create all test digests
    for (const digest of testDigests) {
      await base44.asServiceRole.entities.EmailDigest.create(digest);
    }

    return Response.json({
      success: true,
      message: `Created ${testDigests.length} test digest entries for ${email}`,
      count: testDigests.length
    });

  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});