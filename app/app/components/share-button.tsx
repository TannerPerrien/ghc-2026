import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { Button } from "~/components/ui/button";
import { encodeSchedule, buildShareUrl } from "~/lib/sharing";
import type { SharedSchedule } from "~/lib/types";

interface ShareButtonProps {
  userId: string;
  locationSlug: string;
  schedule: import("~/lib/types").ScheduleSelections;
}

export function ShareButton({ userId, locationSlug, schedule }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const data: SharedSchedule = {
      userId,
      locationSlug,
      selections: schedule,
      sharedAt: new Date().toISOString(),
    };
    const encoded = encodeSchedule(data);
    const url = buildShareUrl(locationSlug, encoded);

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: open a prompt with the URL
      prompt("Copy this share link:", url);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleShare} className="text-xs gap-1.5">
      {copied ? (
        <>
          <Check className="size-3.5 text-green-600" />
          Copied!
        </>
      ) : (
        <>
          <Share2 className="size-3.5" />
          Share
        </>
      )}
    </Button>
  );
}
