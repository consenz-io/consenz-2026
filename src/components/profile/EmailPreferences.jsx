import { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Mail } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

/**
 * Lets a signed-in user change the email consent they gave at registration.
 */
export default function EmailPreferences({ user }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const handleChange = async (checked) => {
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      await base44.auth.updateMe({
        emailOptIn: checked,
        emailOptInAt: checked ? new Date().toISOString() : null,
      });
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      setSaved(true);
    } catch {
      setError(t("emailPreferencesError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 md:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <Mail className="w-4 h-4 text-slate-600" aria-hidden="true" />
            {t("emailPreferencesTitle")}
          </p>
          <p className="text-xs text-slate-600 mt-1">{t("emailPreferencesHint")}</p>
        </div>
        <Switch
          checked={user.emailOptIn !== false}
          onCheckedChange={handleChange}
          disabled={saving}
          aria-label={t("emailPreferencesTitle")}
        />
      </div>
      {saved && <p className="text-xs text-green-700 mt-2">{t("emailPreferencesSaved")}</p>}
      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
      <p className="text-xs text-slate-500 mt-2">
        <Link to="/PrivacyPolicy" className="hover:underline">
          {t("legalPrivacyPolicy")}
        </Link>
        <span className="mx-2" aria-hidden="true">·</span>
        <Link to="/TermsOfUse" className="hover:underline">
          {t("legalTermsOfUse")}
        </Link>
      </p>
    </div>
  );
}