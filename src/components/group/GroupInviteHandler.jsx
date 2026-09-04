import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";

/**
 * Reads the `groupInvite` URL parameter after the user is authenticated,
 * calls the `acceptGroupInvitation` backend function, and redirects to the group.
 * Handles both email-based and link-based invitations.
 */
export default function GroupInviteHandler({ user }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const processedRef = useRef(false);

  useEffect(() => {
    if (!user?.id || processedRef.current) return;

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("groupInvite");
    if (!token) return;

    processedRef.current = true;

    (async () => {
      try {
        const res = await base44.functions.invoke("acceptGroupInvitation", { token });
        if (res?.data?.success) {
          toast.success(
            user.preferredLanguage === "en"
              ? "You joined the group!"
              : user.preferredLanguage === "ar"
              ? "انضممت إلى المجموعة!"
              : "הצטרפת לקבוצה בהצלחה!"
          );
          queryClient.invalidateQueries({ queryKey: ["groups"] });
          queryClient.invalidateQueries({ queryKey: ["groupMembers"] });

          // Clean the URL
          urlParams.delete("groupInvite");
          const cleanUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams}` : "");
          window.history.replaceState({}, "", cleanUrl);

          // Redirect to the group
          navigate(`${createPageUrl("GroupView")}?id=${res.data.groupId}`);
        }
      } catch (err) {
        console.error("Group invite error:", err);
        toast.error(
          user.preferredLanguage === "en"
            ? "Could not accept the group invitation"
            : user.preferredLanguage === "ar"
            ? "تعذر قبول دعوة المجموعة"
            : "לא ניתן היה לקבל את ההזמנה לקבוצה"
        );
        // Clean the URL even on failure
        urlParams.delete("groupInvite");
        const cleanUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams}` : "");
        window.history.replaceState({}, "", cleanUrl);
      }
    })();
  }, [user?.id]);

  return null;
}