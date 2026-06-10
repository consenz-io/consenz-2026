/**
 * TutorialGhostPoints
 * Renders a ghost (disabled/faded) points badge as a portal,
 * allowing users to click it during the points.explain tutorial step
 * when they're not logged in.
 * Used during 'points-explain' step when no real user is logged in.
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Coins } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { Badge } from '@/components/ui/badge';
import PointsInfoModal from '@/components/points/PointsInfoModal';

const GHOST_POINTS = 1000;

export default function TutorialGhostPoints() {
  const { language, isRTL } = useLanguage();
  const [container, setContainer] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Find the header or a suitable container for the badge
    const header = document.querySelector('header');
    if (!header) return;

    // Check if a ghost points badge already exists
    if (header.querySelector('[data-tutorial-ghost-points="true"]')) return;

    const wrapper = window.document.createElement('div');
    wrapper.setAttribute('data-tutorial-ghost-points', 'true');
    wrapper.style.position = 'fixed';
    wrapper.style.top = '1rem';
    wrapper.style.right = isRTL ? 'auto' : '1.5rem';
    wrapper.style.left = isRTL ? '1.5rem' : 'auto';
    wrapper.style.zIndex = '40';
    wrapper.style.pointerEvents = 'auto';
    wrapper.style.opacity = '0.8';
    wrapper.style.animation = 'tutorial-ghost-vote-pulse 1.4s ease-in-out infinite';

    header.appendChild(wrapper);
    setContainer(wrapper);

    return () => {
      if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
      setContainer(null);
    };
  }, [isRTL]);

  if (!container) return null;

  return (
    <>
      {createPortal(
        <button
          onClick={() => setShowModal(true)}
          className={`bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all hover:scale-110 focus:ring-4 focus:ring-amber-300 cursor-pointer`}
          aria-label={language === 'he' ? `${GHOST_POINTS} נקודות` : language === 'ar' ? `${GHOST_POINTS} نقاط` : `${GHOST_POINTS} points`}
          type="button"
        >
          <div className="flex items-center gap-1.5">
            <Coins className="w-5 h-5" aria-hidden="true" />
            <span className="font-bold text-sm tabular-nums">{GHOST_POINTS}</span>
          </div>
        </button>,
        container
      )}

      <PointsInfoModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}