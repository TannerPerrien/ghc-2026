import { useMemo, useState } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — types declare only default export but CJS bundle exposes named
import { QRCode } from "react-qr-code";
import { Share2, Copy, Check } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { encodeSchedule, buildShareUrl } from "~/lib/sharing";
import type { SharedSchedule } from "~/lib/types";

interface ShareButtonProps {
  userId: string;
  locationSlug: string;
  schedule: import("~/lib/types").ScheduleSelections;
}

export function ShareButton({ userId, locationSlug, schedule }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const url = useMemo(
    () =>
      buildShareUrl(
        locationSlug,
        encodeSchedule({
          userId,
          locationSlug,
          selections: schedule,
          sharedAt: new Date().toISOString(),
        } satisfies SharedSchedule)
      ),
    [userId, locationSlug, schedule]
  );

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Copy this share link:", url);
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs gap-1.5">
          <Share2 className="size-3.5" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Share your schedule</DialogTitle>
        </DialogHeader>

        <div className="flex justify-center py-2">
          <QRCode value={url} level="L" style={{ width: "100%", height: "auto" }} />
        </div>

        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={url}
            className="text-xs font-mono text-muted-foreground"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <Button variant="outline" size="icon" onClick={handleCopy} title="Copy link">
            {copied ? (
              <Check className="size-4 text-green-600" />
            ) : (
              <Copy className="size-4" />
            )}
          </Button>
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
