import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useLanguage } from "@/components/LanguageContext";

const MAX_TILT = 9;

// Low consensus = the wording is still moving, so the "dynamic" pan carries more
// weight and sinks; high consensus settles it on the "stable" pan.
function tiltFor(value, isRTL) {
  const v = Math.min(100, Math.max(0, value));
  const lean = ((50 - v) / 50) * MAX_TILT;
  return isRTL ? lean : -lean;
}

/**
 * The consensus meter as a pair of scales. On every stage change the beam swings
 * from the meter's previous value to its new one, so the shift reads as weight
 * moving between "dynamic" and "stable" instead of a dot jumping along a bar.
 */
export default function ConsensusScales({ stage }) {
  const reducedMotion = useReducedMotion();
  const { isRTL } = useLanguage();
  const [meter, setMeter] = useState(stage.meter);

  useEffect(() => {
    setMeter(stage.meter);
    if (reducedMotion) {
      setMeter(stage.meterAfter);
      return;
    }
    const frame = requestAnimationFrame(() => setMeter(stage.meterAfter));
    return () => cancelAnimationFrame(frame);
  }, [stage.meter, stage.meterAfter, reducedMotion]);

  const tilt = tiltFor(meter, isRTL);

  const pans = [
    {
      side: isRTL ? "right" : "left",
      kind: "dynamic",
      bowl: "border-amber-500 bg-amber-100",
    },
    {
      side: isRTL ? "left" : "right",
      kind: "stable",
      bowl: "border-emerald-500 bg-emerald-100",
    },
  ];

  return (
    <div
      className="relative mx-auto h-[88px] w-full max-w-[280px] select-none"
      aria-hidden="true"
    >
      {/* pillar and base */}
      <div className="absolute bottom-[7px] left-1/2 top-[17px] w-[3px] -translate-x-1/2 rounded bg-slate-300" />
      <div className="absolute bottom-0 left-1/2 h-[6px] w-24 -translate-x-1/2 rounded-full bg-slate-300" />

      {/* beam — swings between the previous and the new meter value */}
      <div
        className="absolute left-3 right-3 top-[16px] h-[3px] origin-center rounded-full bg-slate-700 transition-transform duration-[900ms] ease-out"
        style={{ transform: `rotate(${tilt}deg)` }}
      >
        {pans.map((pan) => (
          <div
            key={pan.kind}
            className={`absolute top-0 w-14 ${
              pan.side === "left" ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2"
            }`}
          >
            <div className="mx-auto h-4 w-px bg-slate-400" />
            {/* the bowl stays level while the beam tilts */}
            <div
              className="transition-transform duration-[900ms] ease-out"
              style={{ transform: `rotate(${-tilt}deg)` }}
            >
              <div className={`mx-auto h-[10px] w-14 rounded-b-full border-2 border-t-0 ${pan.bowl}`} />
            </div>
          </div>
        ))}
      </div>

      {/* pivot */}
      <div className="absolute left-1/2 top-[12px] h-[11px] w-[11px] -translate-x-1/2 rounded-full border-2 border-white bg-slate-700" />
    </div>
  );
}