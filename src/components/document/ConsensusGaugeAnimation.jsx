import React, { useEffect, useRef } from "react";
import { Gauge } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

/**
 * Animated semicircular gauge that sweeps from 0 to the document's consensus
 * meter value. The needle position is computed directly from the animated
 * state (no CSS rotation on SVG) for reliable cross-browser rendering.
 */
const ConsensusGaugeAnimationInner = function ConsensusGaugeAnimation({ value, documentTitle }) {
  const { language } = useLanguage();
  const pct = Math.min(100, Math.max(0, value * 100));

  // Semicircle geometry (constants — computed once)
  const cx = 110;
  const cy = 100;
  const radius = 90;
  const stroke = 16;
  const needleLen = radius - stroke - 8;
  const circumference = Math.PI * radius;

  // Refs for the three animated SVG elements — updated directly in the
  // animation loop WITHOUT setState, eliminating ~48 re-renders per cycle.
  const needleRef = useRef(null);
  const arcRef = useRef(null);
  const textRef = useRef(null);

  useEffect(() => {
    const duration = 800;
    const start = performance.now();
    let raf;

    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentPct = pct * eased;

      // Direct DOM updates — zero React re-renders
      if (needleRef.current) {
        const angleDeg = 180 - (currentPct / 100) * 180;
        const angleRad = (angleDeg * Math.PI) / 180;
        needleRef.current.setAttribute('x2', String(cx + needleLen * Math.cos(angleRad)));
        needleRef.current.setAttribute('y2', String(cy - needleLen * Math.sin(angleRad)));
      }
      if (arcRef.current) {
        arcRef.current.setAttribute('strokeDashoffset', String(circumference - (currentPct / 100) * circumference));
      }
      if (textRef.current) {
        textRef.current.textContent = `${currentPct.toFixed(0)}%`;
      }

      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pct, cx, cy, needleLen, circumference]);

  const label = language === 'he' ? 'מד הקונצנזוס של המסמך' : language === 'ar' ? 'مقياس إجماع الوثيقة' : 'Document Consensus Meter';
  const subtitle = language === 'he' ? 'רמת ההסכמה הנוכחית על השינויים שהתקבלו' : language === 'ar' ? 'مستوى الاتفاق الحالي على التغييرات المقبولة' : 'Current agreement level on accepted changes';

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <div className="flex items-center gap-2 mb-1">
        <Gauge className="w-5 h-5 text-indigo-600" />
        <span className="text-sm font-bold text-indigo-700">{label}</span>
      </div>
      {documentTitle && (
        <p className="text-xs text-slate-500 mb-1 text-center max-w-md truncate px-4">"{documentTitle}"</p>
      )}
      <svg width="220" height="125" viewBox="0 0 220 125" className="max-w-full overflow-visible">
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
        {/* Filled arc — driven by ref-based animation (no re-renders) */}
        <path
          ref={arcRef}
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
        />
        {/* Tick marks at 0%, 50%, 100% */}
        {[0, 50, 100].map((tick) => {
          const a = ((180 - (tick / 100) * 180) * Math.PI) / 180;
          const x1 = cx + (radius - stroke / 2 - 2) * Math.cos(a);
          const y1 = cy - (radius - stroke / 2 - 2) * Math.sin(a);
          const x2 = cx + (radius + stroke / 2 + 2) * Math.cos(a);
          const y2 = cy - (radius + stroke / 2 + 2) * Math.sin(a);
          return (
            <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth="2" />
          );
        })}
        {/* Needle — ref-based animation updates x2/y2 directly */}
        <line
          ref={needleRef}
          x1={cx}
          y1={cy}
          x2={cx - needleLen}
          y2={cy}
          stroke="#1e293b"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Center pivot */}
        <circle cx={cx} cy={cy} r="7" fill="#1e293b" />
        <circle cx={cx} cy={cy} r="3" fill="#fff" />
        {/* Min / Max labels */}
        <text x={cx - radius} y={cy + 18} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 10 }}>0%</text>
        <text x={cx + radius} y={cy + 18} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 10 }}>100%</text>
      </svg>
      {/* Percentage value — ref updates textContent directly during animation */}
      <div ref={textRef} className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 -mt-1">
        0%
      </div>
      <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
    </div>
  );
}

// React.memo prevents re-render (and animation restart) when the parent
// re-renders on subscriptions/scroll but value + documentTitle are unchanged.
export default React.memo(ConsensusGaugeAnimationInner);