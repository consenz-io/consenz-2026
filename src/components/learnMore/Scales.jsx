import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * A two-pan balance. `tilt` is in physical degrees — positive sinks the right
 * pan. The beam eases from wherever it stood to the new value, so a change
 * reads as weight moving rather than a jump. `entranceTilt` is where it starts
 * on first paint, for a settling animation when the card appears.
 */
export default function Scales({
  tilt,
  entranceTilt = tilt,
  leftBowl = "border-amber-500 bg-amber-100",
  rightBowl = "border-emerald-500 bg-emerald-100",
}) {
  const reducedMotion = useReducedMotion();
  const [current, setCurrent] = useState(entranceTilt);

  useEffect(() => {
    if (reducedMotion) {
      setCurrent(tilt);
      return;
    }
    const frame = requestAnimationFrame(() => setCurrent(tilt));
    return () => cancelAnimationFrame(frame);
  }, [tilt, reducedMotion]);

  const pans = [
    { side: "left", bowl: leftBowl },
    { side: "right", bowl: rightBowl },
  ];

  return (
    <div
      className="relative mx-auto h-[88px] w-full max-w-[280px] select-none"
      aria-hidden="true"
    >
      {/* pillar and base */}
      <div className="absolute bottom-[7px] left-1/2 top-[17px] w-[3px] -translate-x-1/2 rounded bg-slate-300" />
      <div className="absolute bottom-0 left-1/2 h-[6px] w-24 -translate-x-1/2 rounded-full bg-slate-300" />

      {/* beam */}
      <div
        className="absolute left-3 right-3 top-[16px] h-[3px] origin-center rounded-full bg-slate-700 transition-transform duration-[900ms] ease-out"
        style={{ transform: `rotate(${current}deg)` }}
      >
        {pans.map((pan) => (
          <div
            key={pan.side}
            className={`absolute top-0 w-14 ${
              pan.side === "left" ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2"
            }`}
          >
            <div className="mx-auto h-4 w-px bg-slate-400" />
            {/* the bowl stays level while the beam tilts */}
            <div
              className="transition-transform duration-[900ms] ease-out"
              style={{ transform: `rotate(${-current}deg)` }}
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