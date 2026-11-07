import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useLanguage } from "@/components/LanguageContext";
import { getLearnMoreContent } from "@/components/learnMore";
import LearnMoreHero from "@/components/learnMore/LearnMoreHero";
import ValuePillars from "@/components/learnMore/ValuePillars";
import HowItWorksSteps from "@/components/learnMore/HowItWorksSteps";
import ConsensusExplainer from "@/components/learnMore/ConsensusExplainer";
import CapabilitiesGrid from "@/components/learnMore/CapabilitiesGrid";
import PointsEconomy from "@/components/learnMore/PointsEconomy";
import LearnMoreAudiences from "@/components/learnMore/LearnMoreAudiences";
import LearnMoreCta from "@/components/learnMore/LearnMoreCta";

export default function LearnMore() {
  const { language, isRTL } = useLanguage();
  const location = useLocation();
  const content = getLearnMoreContent(language);

  // Deep link from the home page stats to the consensus explanation
  useEffect(() => {
    if (location.hash !== "#consensus-calculation") return;
    const timer = setTimeout(() => {
      document
        .getElementById("consensus-calculation")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => clearTimeout(timer);
  }, [location.hash]);

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <LearnMoreHero c={content.hero} isRTL={isRTL} />
      <ValuePillars c={content.pillars} />
      <HowItWorksSteps c={content.how} />
      <ConsensusExplainer c={content.consensus} />
      <CapabilitiesGrid c={content.capabilities} />
      <PointsEconomy c={content.points} />
      <LearnMoreAudiences c={content.audiences} />
      <LearnMoreCta c={content.cta} />
    </div>
  );
}