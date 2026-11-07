import he from "./content.he";
import en from "./content.en";
import ar from "./content.ar";

export const getLearnMoreContent = (language) => {
  if (language === "en") return en;
  if (language === "ar") return ar;
  return he;
};