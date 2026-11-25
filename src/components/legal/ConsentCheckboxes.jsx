import React from "react";
import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/components/LanguageContext";

/**
 * Registration consents: the required agreement to the Terms of Use and
 * Privacy Policy, and the optional agreement to receive emails.
 */
export default function ConsentCheckboxes({
  acceptedTerms,
  onAcceptedTermsChange,
  emailOptIn,
  onEmailOptInChange,
}) {
  const { t } = useLanguage();

  const labelParts = t("consentTermsLabel").split(/(\{terms\}|\{privacy\})/);

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex items-start gap-2.5">
        <Checkbox
          id="terms-consent"
          checked={acceptedTerms}
          onCheckedChange={onAcceptedTermsChange}
          className="mt-0.5 shrink-0"
        />
        <label htmlFor="terms-consent" className="text-xs leading-relaxed text-slate-600 cursor-pointer">
          {labelParts.map((part, index) => {
            if (part === "{terms}") {
              return (
                <Link
                  key={index}
                  to="/TermsOfUse"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 font-medium hover:underline"
                >
                  {t("legalTermsOfUse")}
                </Link>
              );
            }
            if (part === "{privacy}") {
              return (
                <Link
                  key={index}
                  to="/PrivacyPolicy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 font-medium hover:underline"
                >
                  {t("legalPrivacyPolicy")}
                </Link>
              );
            }
            return <React.Fragment key={index}>{part}</React.Fragment>;
          })}
        </label>
      </div>

      <div className="flex items-start gap-2.5">
        <Checkbox
          id="email-consent"
          checked={emailOptIn}
          onCheckedChange={onEmailOptInChange}
          className="mt-0.5 shrink-0"
        />
        <label htmlFor="email-consent" className="text-xs leading-relaxed text-slate-600 cursor-pointer">
          {t("consentEmailLabel")}
          <span className="block mt-0.5 text-[11px] text-slate-500">{t("consentEmailHint")}</span>
        </label>
      </div>
    </div>
  );
}