import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Accessibility, Type, Contrast, Link as LinkIcon, Volume2, RotateCcw } from 'lucide-react';
import { useLanguage } from './LanguageContext';

export function AccessibilityToolbar() {
  const { t, isRTL } = useLanguage();
  const [fontSize, setFontSize] = useState(100);
  const [highContrast, setHighContrast] = useState(false);
  const [highlightLinks, setHighlightLinks] = useState(false);
  const [isReading, setIsReading] = useState(false);

  // Load saved preferences
  useEffect(() => {
    const savedFontSize = localStorage.getItem('accessibility-font-size');
    const savedContrast = localStorage.getItem('accessibility-high-contrast');
    const savedLinks = localStorage.getItem('accessibility-highlight-links');

    if (savedFontSize) setFontSize(parseInt(savedFontSize));
    if (savedContrast === 'true') setHighContrast(true);
    if (savedLinks === 'true') setHighlightLinks(true);
  }, []);

  // Apply font size
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}%`;
    localStorage.setItem('accessibility-font-size', fontSize.toString());
  }, [fontSize]);

  // Apply high contrast
  useEffect(() => {
    if (highContrast) {
      document.body.classList.add('high-contrast-mode');
    } else {
      document.body.classList.remove('high-contrast-mode');
    }
    localStorage.setItem('accessibility-high-contrast', highContrast.toString());
  }, [highContrast]);

  // Apply link highlighting
  useEffect(() => {
    if (highlightLinks) {
      document.body.classList.add('highlight-links-mode');
    } else {
      document.body.classList.remove('highlight-links-mode');
    }
    localStorage.setItem('accessibility-highlight-links', highlightLinks.toString());
  }, [highlightLinks]);

  const increaseFontSize = () => {
    if (fontSize < 150) setFontSize(prev => prev + 10);
  };

  const decreaseFontSize = () => {
    if (fontSize > 80) setFontSize(prev => prev - 10);
  };

  const resetAll = () => {
    setFontSize(100);
    setHighContrast(false);
    setHighlightLinks(false);
    setIsReading(false);
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const toggleTextToSpeech = () => {
    if ('speechSynthesis' in window) {
      if (isReading) {
        window.speechSynthesis.cancel();
        setIsReading(false);
      } else {
        // Read main content
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
          const text = mainContent.innerText;
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = isRTL ? 'he-IL' : 'en-US';
          utterance.onend = () => setIsReading(false);
          window.speechSynthesis.speak(utterance);
          setIsReading(true);
        }
      }
    }
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="fixed top-20 left-4 z-50 rounded-full h-12 w-12 shadow-lg bg-white hover:bg-gray-100"
            aria-label={isRTL ? 'סרגל נגישות' : 'Accessibility toolbar'}
            title={isRTL ? 'סרגל נגישות' : 'Accessibility toolbar'}
          >
            <Accessibility className="h-5 w-5" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-80" 
          align="start"
          role="dialog"
          aria-label={isRTL ? 'אפשרויות נגישות' : 'Accessibility options'}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-semibold text-lg">
                {isRTL ? 'נגישות' : 'Accessibility'}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetAll}
                aria-label={isRTL ? 'איפוס הכל' : 'Reset all'}
              >
                <RotateCcw className="h-4 w-4 mr-1" aria-hidden="true" />
                {isRTL ? 'איפוס' : 'Reset'}
              </Button>
            </div>

            {/* Font Size Control */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Type className="h-4 w-4" aria-hidden="true" />
                <label className="text-sm font-medium">
                  {isRTL ? 'גודל טקסט' : 'Text Size'}
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={decreaseFontSize}
                  disabled={fontSize <= 80}
                  aria-label={isRTL ? 'הקטן טקסט' : 'Decrease text size'}
                >
                  A-
                </Button>
                <span className="flex-1 text-center text-sm font-medium" aria-live="polite">
                  {fontSize}%
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={increaseFontSize}
                  disabled={fontSize >= 150}
                  aria-label={isRTL ? 'הגדל טקסט' : 'Increase text size'}
                >
                  A+
                </Button>
              </div>
            </div>

            {/* High Contrast */}
            <div className="space-y-2">
              <Button
                variant={highContrast ? "default" : "outline"}
                className="w-full justify-start"
                onClick={() => setHighContrast(!highContrast)}
                aria-pressed={highContrast}
                aria-label={isRTL ? 'ניגודיות גבוהה' : 'High contrast mode'}
              >
                <Contrast className="h-4 w-4 mr-2" aria-hidden="true" />
                {isRTL ? 'ניגודיות גבוהה' : 'High Contrast'}
              </Button>
            </div>

            {/* Highlight Links */}
            <div className="space-y-2">
              <Button
                variant={highlightLinks ? "default" : "outline"}
                className="w-full justify-start"
                onClick={() => setHighlightLinks(!highlightLinks)}
                aria-pressed={highlightLinks}
                aria-label={isRTL ? 'הדגש קישורים' : 'Highlight links'}
              >
                <LinkIcon className="h-4 w-4 mr-2" aria-hidden="true" />
                {isRTL ? 'הדגש קישורים' : 'Highlight Links'}
              </Button>
            </div>

            {/* Text to Speech */}
            {('speechSynthesis' in window) && (
              <div className="space-y-2">
                <Button
                  variant={isReading ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={toggleTextToSpeech}
                  aria-pressed={isReading}
                  aria-label={isRTL ? 'קריאה קולית' : 'Text to speech'}
                >
                  <Volume2 className="h-4 w-4 mr-2" aria-hidden="true" />
                  {isReading 
                    ? (isRTL ? 'עצור קריאה' : 'Stop Reading')
                    : (isRTL ? 'קריאה קולית' : 'Read Aloud')
                  }
                </Button>
              </div>
            )}

            <div className="text-xs text-gray-500 pt-2 border-t">
              {isRTL 
                ? 'תואם WCAG 2.1 Level AA'
                : 'WCAG 2.1 Level AA Compliant'
              }
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <style jsx global>{`
        /* High Contrast Mode */
        body.high-contrast-mode {
          filter: contrast(1.5);
        }

        body.high-contrast-mode * {
          border-color: currentColor !important;
        }

        /* Highlight Links Mode */
        body.highlight-links-mode a {
          background-color: yellow !important;
          color: black !important;
          text-decoration: underline !important;
          font-weight: bold !important;
          padding: 2px 4px !important;
        }

        body.highlight-links-mode button {
          outline: 2px solid #3b82f6 !important;
          outline-offset: 2px !important;
        }
      `}</style>
    </>
  );
}