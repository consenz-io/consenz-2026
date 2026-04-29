/**
 * טסטים למד הקונצנזוס - ליבת המערכת
 * מוודא שהחישוב של הדלתא והקונצנזוס עובד נכון
 */

describe('Consensus Meter Tests', () => {
  
  // פונקציה עזר לחישוב דלתא
  const calculateDelta = (proVotes, conVotes) => {
    return proVotes - conVotes;
  };
  
  // פונקציה עזר לחישוב threshold דינמי מהצעות מאושרות
  const calculateDynamicThreshold = (acceptedSuggestions, defaultThreshold = 2) => {
    if (acceptedSuggestions.length === 0) {
      return defaultThreshold;
    }
    
    const deltas = acceptedSuggestions.map(s => {
      return (s.proVotes || 0) - (s.conVotes || 0);
    });
    const avgDelta = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
    return Math.max(1, Math.round(avgDelta));
  };
  
  // פונקציה עזר לחישוב הצבעות נדרשות
  const calculateVotesNeeded = (proVotes, conVotes, threshold) => {
    const currentDelta = calculateDelta(proVotes, conVotes);
    
    if (currentDelta >= threshold) {
      return 0;
    }
    
    return threshold - currentDelta;
  };
  
  describe('Basic Delta Calculation', () => {
    test('חישוב דלתא בסיסי - ללא הצבעות', () => {
      expect(calculateDelta(0, 0)).toBe(0);
    });
    
    test('חישוב דלתא - רק הצבעות בעד', () => {
      expect(calculateDelta(3, 0)).toBe(3);
    });
    
    test('חישוב דלתא - עם הצבעות נגד', () => {
      expect(calculateDelta(5, 2)).toBe(3);
    });
    
    test('חישוב דלתא - יותר הצבעות נגד מאשר בעד', () => {
      expect(calculateDelta(2, 5)).toBe(-3);
    });
  });
  
  describe('Threshold Calculation', () => {
    test('threshold ברירת מחדל - ללא הצעות מאושרות', () => {
      expect(calculateDynamicThreshold([])).toBe(2);
    });
    
    test('threshold ברירת מחדל מותאם', () => {
      expect(calculateDynamicThreshold([], 3)).toBe(3);
    });
    
    test('threshold מחושב - הצעה מאושרת אחת', () => {
      const acceptedSuggestions = [
        { proVotes: 5, conVotes: 2 } // delta = 3
      ];
      expect(calculateDynamicThreshold(acceptedSuggestions)).toBe(3);
    });
    
    test('threshold מחושב - ממוצע של כמה הצעות', () => {
      const acceptedSuggestions = [
        { proVotes: 5, conVotes: 2 }, // delta = 3
        { proVotes: 7, conVotes: 2 }, // delta = 5
        { proVotes: 4, conVotes: 2 }  // delta = 2
      ];
      // ממוצע: (3 + 5 + 2) / 3 = 3.33 => round = 3
      expect(calculateDynamicThreshold(acceptedSuggestions)).toBe(3);
    });
    
    test('threshold מחושב - ממוצע נמוך', () => {
      const acceptedSuggestions = [
        { proVotes: 2, conVotes: 1 }, // delta = 1
        { proVotes: 2, conVotes: 1 }  // delta = 1
      ];
      // ממוצע: (1 + 1) / 2 = 1
      expect(calculateDynamicThreshold(acceptedSuggestions)).toBe(1);
    });
    
    test('threshold מינימלי הוא 1', () => {
      const acceptedSuggestions = [
        { proVotes: 1, conVotes: 0 } // delta = 1
      ];
      expect(calculateDynamicThreshold(acceptedSuggestions)).toBeGreaterThanOrEqual(1);
    });
  });
  
  describe('Votes Needed Calculation', () => {
    test('ללא הצבעות - threshold = 2', () => {
      expect(calculateVotesNeeded(0, 0, 2)).toBe(2);
    });
    
    test('הצבעה אחת בעד - threshold = 2', () => {
      expect(calculateVotesNeeded(1, 0, 2)).toBe(1);
    });
    
    test('שתי הצבעות בעד - threshold = 2 (עובר)', () => {
      expect(calculateVotesNeeded(2, 0, 2)).toBe(0);
    });
    
    test('הצבעת נגד מגדילה את הדרישה באחד', () => {
      // threshold = 2
      // 1 בעד, 0 נגד => צריך עוד 1
      expect(calculateVotesNeeded(1, 0, 2)).toBe(1);
      
      // 1 בעד, 1 נגד => דלתא = 0, צריך עוד 2
      expect(calculateVotesNeeded(1, 1, 2)).toBe(2);
      
      // 2 בעד, 1 נגד => דלתא = 1, צריך עוד 1
      expect(calculateVotesNeeded(2, 1, 2)).toBe(1);
    });
    
    test('כל הצבעת נגד מוסיפה 1 לדרישה', () => {
      const threshold = 2;
      
      // ללא נגד
      expect(calculateVotesNeeded(1, 0, threshold)).toBe(1);
      
      // נגד אחת
      expect(calculateVotesNeeded(1, 1, threshold)).toBe(2);
      
      // שתי נגד
      expect(calculateVotesNeeded(1, 2, threshold)).toBe(3);
      
      // שלוש נגד
      expect(calculateVotesNeeded(1, 3, threshold)).toBe(4);
    });
    
    test('threshold גבוה יותר', () => {
      const threshold = 5;
      
      expect(calculateVotesNeeded(0, 0, threshold)).toBe(5);
      expect(calculateVotesNeeded(3, 0, threshold)).toBe(2);
      expect(calculateVotesNeeded(5, 0, threshold)).toBe(0);
      expect(calculateVotesNeeded(3, 2, threshold)).toBe(4); // delta=1, need 4 more
    });
  });
  
  describe('Real World Scenarios', () => {
    test('מסמך חדש - הצעה ראשונה', () => {
      const threshold = 2; // ברירת מחדל
      const proVotes = 0;
      const conVotes = 0;
      
      expect(calculateVotesNeeded(proVotes, conVotes, threshold)).toBe(2);
    });
    
    test('מסמך חדש - אחרי הצבעה אחת בעד', () => {
      const threshold = 2;
      const proVotes = 1;
      const conVotes = 0;
      
      expect(calculateVotesNeeded(proVotes, conVotes, threshold)).toBe(1);
    });
    
    test('מסמך חדש - אחרי הצבעה אחת בעד ואחת נגד', () => {
      const threshold = 2;
      const proVotes = 1;
      const conVotes = 1;
      
      // דלתא = 0, צריך עוד 2
      expect(calculateVotesNeeded(proVotes, conVotes, threshold)).toBe(2);
    });
    
    test('מסמך עם היסטוריה - threshold מחושב', () => {
      const acceptedSuggestions = [
        { proVotes: 5, conVotes: 1 }, // delta = 4
        { proVotes: 6, conVotes: 2 }, // delta = 4
        { proVotes: 7, conVotes: 2 }  // delta = 5
      ];
      // ממוצע: (4 + 4 + 5) / 3 = 4.33 => round = 4
      const threshold = calculateDynamicThreshold(acceptedSuggestions);
      expect(threshold).toBe(4);
      
      // הצעה חדשה עם 2 בעד, 1 נגד => delta = 1
      expect(calculateVotesNeeded(2, 1, threshold)).toBe(3);
    });
    
    test('הצעה שעוברת את הסף', () => {
      const threshold = 3;
      const proVotes = 5;
      const conVotes = 2;
      
      // delta = 3, threshold = 3 => עובר!
      expect(calculateVotesNeeded(proVotes, conVotes, threshold)).toBe(0);
    });
    
    test('הצעה שחוצה את הסף בדיוק', () => {
      const threshold = 2;
      const proVotes = 3;
      const conVotes = 1;
      
      // delta = 2, threshold = 2 => עובר בדיוק!
      expect(calculateVotesNeeded(proVotes, conVotes, threshold)).toBe(0);
    });
  });
  
  describe('Edge Cases', () => {
    test('הצבעות נגד בלבד', () => {
      const threshold = 2;
      const proVotes = 0;
      const conVotes = 3;
      
      // delta = -3, need to get to 2 => need 5 pro votes
      expect(calculateVotesNeeded(proVotes, conVotes, threshold)).toBe(5);
    });
    
    test('threshold = 1 (מינימלי)', () => {
      const threshold = 1;
      
      expect(calculateVotesNeeded(0, 0, threshold)).toBe(1);
      expect(calculateVotesNeeded(1, 0, threshold)).toBe(0);
      expect(calculateVotesNeeded(0, 1, threshold)).toBe(2);
    });
    
    test('מספרים גדולים', () => {
      const threshold = 10;
      const proVotes = 50;
      const conVotes = 45;
      
      // delta = 5, need 5 more to get to 10
      expect(calculateVotesNeeded(proVotes, conVotes, threshold)).toBe(5);
    });
  });
});