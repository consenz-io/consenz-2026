/**
 * TutorialGhostVoting
 * Renders a real VotingProgressSection (and optionally the navigation arrows header)
 * as a React portal inside the first .section-card on the page.
 * Used during tutorial steps 'vote-explain' and 'support-threshold-explain'
 * when no real pending suggestions exist for the section.
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import VotingProgressSection from '@/components/document/VotingProgressSection';
import { useLanguage } from '@/components/LanguageContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Stub suggestion data that looks realistic
const STUB_SUGGESTION = {
  id: '__tutorial_ghost__',
  proVotes: 3,
  conVotes: 1,
  status: 'pending',
  timerEndsAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
};

const STUB_DOCUMENT = {
  id: '__tutorial_ghost_doc__',
  threshold: 5,
  votingButtonsEnabled: true,
};

const STUB_VOTE_MUTATION = {
  isPending: false,
  mutate: () => {},
};

export default function TutorialGhostVoting({ showNavArrows = false }) {
  const { isRTL, language } = useLanguage();
  const [container, setContainer] = useState(null);

  useEffect(() => {
    const sectionCard = document.querySelector('.section-card');
    if (!sectionCard) return;

    // Only inject if no real proposals are visible
    if (sectionCard.querySelector('.proposal-vote-buttons')) return;

    const wrapper = window.document.createElement('div');
    wrapper.setAttribute('data-tutorial-ghost', 'true');
    wrapper.style.pointerEvents = 'none';
    wrapper.style.opacity = '0.8';
    wrapper.style.animation = 'tutorial-ghost-vote-pulse 1.4s ease-in-out infinite';
    
    // Add CSS to colorize the disabled buttons
    const style = window.document.createElement('style');
    style.textContent = `
      [data-tutorial-ghost] button[disabled]:nth-child(1) {
        background-color: #dcfce7 !important;
        border-color: #22c55e !important;
        color: #166534 !important;
        opacity: 1 !important;
      }
      [data-tutorial-ghost] button[disabled]:nth-child(2) {
        background-color: #fee2e2 !important;
        border-color: #ef4444 !important;
        color: #991b1b !important;
        opacity: 1 !important;
      }
    `;
    wrapper.appendChild(style);
    
    sectionCard.prepend(wrapper);
    setContainer(wrapper);

    return () => {
      if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
      setContainer(null);
    };
  }, []);

  if (!container) return null;

  return createPortal(
    <div className="mb-4 space-y-3">
      {/* Ghost navigation arrows — same markup as SectionCarousel */}
      {showNavArrows && (
        <div className="proposal-navigation-arrows mb-4 border-b-2 p-3 rounded-lg shadow-sm border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="flex items-center justify-between pb-2">
            <button className="flex items-center justify-center w-10 h-10 rounded-xl border-2 font-bold border-amber-300 bg-white text-amber-700" disabled>
              {isRTL ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
            <div className="text-center flex-1 px-2">
              <p className="text-sm"><span className="font-bold text-amber-700 text-lg">1</span> <span className="font-bold text-slate-800">{language === 'he' ? 'הצעות עריכה' : language === 'ar' ? 'اقتراحات تعديل' : 'edit suggestions'}</span></p>
            </div>
            <button className="flex items-center justify-center w-10 h-10 rounded-xl border-2 font-bold border-amber-300 bg-white text-amber-700" disabled>
              {isRTL ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
          </div>
        </div>
      )}

      {/* Real VotingProgressSection with stub data */}
      <div className="proposal-vote-buttons">
        <VotingProgressSection
          suggestion={STUB_SUGGESTION}
          document={STUB_DOCUMENT}
          userVote={null}
          voteMutation={STUB_VOTE_MUTATION}
          isRTL={isRTL}
          readOnly={false}
        />
      </div>
    </div>,
    container
  );
}