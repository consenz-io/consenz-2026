import Scales from "@/components/learnMore/Scales";
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
  const { isRTL } = useLanguage();
  const amber = "border-amber-500 bg-amber-100";
  const emerald = "border-emerald-500 bg-emerald-100";

  return (
    <Scales
      tilt={tiltFor(stage.meterAfter, isRTL)}
      entranceTilt={tiltFor(stage.meter, isRTL)}
      leftBowl={isRTL ? emerald : amber}
      rightBowl={isRTL ? amber : emerald}
    />
  );
}