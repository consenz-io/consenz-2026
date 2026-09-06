import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Gauge } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

/**
 * Animated semicircular gauge that sweeps from 0 to the document's consensus
 * meter value. Placed at the top of the Understanding Consensus page.
 */
export default function ConsensusGaugeAnimation({ value }) {
  const { language } = useLanguage();
  const pct = Math.min(100, Math.max(0, value * 100));
  const [displayPct, setDisplayPct] = useState(0);

  // Animate the number counter from 0 → pct after mount
  useEffect(() => {
    const duration = 1400; // ms
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayPct(pct * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pct]);

  // Semicircle geometry: 180° arc from left (180°) to right (0°)
  const radius = 90;
  const cx = 110;
  const cy = 100;
  const stroke = 18;
  const circumference = Math.PI * radius; // half circle

  // Needle angle: 180° (pointing left) at 0%, 0° (pointing right) at 100%
  const needleAngle = 180 - (displayPct / 100) * 180;

  // Arc dashoffset to fill the gauge proportionally
  const dashOffset = circumference - (displayPct / 100) * circumference;

  const label = language === 'he' ? 'מד הקונצנזוס' : language === 'ar' ? 'مقياس الإجماع' : 'Consensus Meter';

  return (
    <div className="flex flex-col items-center justify-center py-4">
      <div className="flex items-center gap-2 mb-1">
        <Gauge className="w-5 h-5 text-indigo-600" />
        <span className="text-sm font-bold text-indigo-700">{label}</span>
      </div>
      <svg width="220" height="130" viewBox="0 0 220 130" className="max-w-full">
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        {/* Track */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* Filled arc — animated */}
        <motion.path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        />
        {/* Tick marks at 0%, 50%, 100% */}
        {[0, 50, 100].map((tick) => {
          const angle = (180 - (tick / 100) * 180) * (Math.PI / 180);
          const x1 = cx + (radius - stroke / 2 - 2) * Math.cos(angle);
          const y1 = cy - (radius - stroke / 2 - 2) * Math.sin(angle);
          const x2 = cx + (radius + stroke / 2 + 2) * Math.cos(angle);
          const y2 = cy - (radius + stroke / 2 + 2) * Math.sin(angle);
          return (
            <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth="2" />
          );
        })}
        {/* Needle */}
        <motion.g
          style={{ transformOrigin: `${cx}px ${cy}px` }}
          initial={{ rotate: 180 }}
          animate={{ rotate: needleAngle }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        >
          <line
            x1={cx}
            y1={cy}
            x2={cx + radius - stroke - 6}
            y2={cy}
            stroke="#1e293b"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </motion.g>
        {/* Center pivot */}
        <circle cx={cx} cy={cy} r="7" fill="#1e293b" />
        <circle cx={cx} cy={cy} r="3" fill="#fff" />
        {/* Min / Max labels */}
        <text x={cx - radius} y={cy + 18} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 10 }}>0%</text>
        <text x={cx + radius} y={cy + 18} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 10 }}>100%</text>
      </svg>
      {/* Percentage value */}
      <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 -mt-2">
        {displayPct.toFixed(0)}%
      </div>
    </div>
  );
}