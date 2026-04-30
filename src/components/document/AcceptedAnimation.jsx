import React from "react";
import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import DocumentTextContent from "./DocumentTextContent";

/**
 * Shared animation component for when a suggestion gets accepted.
 * Used by both SectionCarousel and NewSectionSuggestionCard.
 * Phases: 'announcing' → 'celebrating' → 'transitioning' → 'completed'
 */
export default function AcceptedAnimation({ phase, newContent }) {
  if (phase === 'announcing') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative overflow-hidden rounded-lg p-8 text-center"
        style={{
          background: 'linear-gradient(135deg, rgb(240 253 244) 0%, rgb(220 252 231) 100%)',
          border: '2px solid rgb(34 197 94)',
        }}
      >
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="text-2xl font-bold text-green-700"
        >
          🎉 ההצעה עברה את סף התמיכה!
        </motion.div>
      </motion.div>
    );
  }

  if (phase === 'celebrating') {
    return (
      <motion.div
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
        className="relative overflow-hidden rounded-lg p-4"
        style={{
          background: 'linear-gradient(135deg, rgb(240 253 244) 0%, rgb(220 252 231) 100%)',
          border: '2px solid rgb(34 197 94)',
        }}
      >
        <motion.div
          className="absolute inset-0 bg-green-500/10"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.3, 0.1] }}
          transition={{ duration: 1 }}
        />
        <div className="relative z-10">
          <div className="flex items-start gap-3 mb-3">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", duration: 0.6 }}
              className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0"
            >
              <CheckCircle className="w-5 h-5 text-white" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-lg font-bold text-green-700"
            >
              ההצעה התקבלה!
            </motion.div>
          </div>
          <div className="prose prose-sm max-w-none">
            <DocumentTextContent content={newContent} className="text-slate-700" />
          </div>
        </div>
      </motion.div>
    );
  }

  if (phase === 'transitioning') {
    return (
      <motion.div
        initial={{
          background: 'linear-gradient(135deg, rgb(240 253 244) 0%, rgb(220 252 231) 100%)',
          borderColor: 'rgb(34 197 94)',
        }}
        animate={{
          background: 'rgb(255 255 255)',
          borderColor: 'rgb(226 232 240)',
        }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
        className="relative overflow-hidden rounded-lg p-4 border-2"
      >
        <div className="prose prose-sm max-w-none">
          <DocumentTextContent content={newContent} className="text-slate-700" />
        </div>
      </motion.div>
    );
  }

  return null;
}