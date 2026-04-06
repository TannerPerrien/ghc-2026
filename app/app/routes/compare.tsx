import { useMemo, useState } from "react";
import type { Route } from "./+types/compare";
import { getLocation, getSpeakersForLocation, getWorkshopTimeSlots, getWorkshopsForLocation } from "~/lib/data";
import { useSchedule } from "~/contexts/schedule-context";
import { WorkshopModalProvider, useWorkshopModal } from "~/contexts/workshop-modal-context";
import { decodeSchedule } from "~/lib/sharing";
import { TrackBadge } from "~/components/track-badge";
import { ImportScheduleDialog } from "~/components/import-schedule-dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Trash2, Link as LinkIcon, ArrowDownToLine, Pencil, Plus } from "lucide-react";
import { cn } from "~/lib/utils";
import type { ScheduleSelections, SharedSchedule, WorkshopWithSchedule } from "~/lib/types";

export function meta() {
  return [{ title: `GHC 2026 — Compare Schedules` }];
}

export function loader({ params }: Route.LoaderArgs) {
  const location = getLocation(params.location);
  const timeSlots = getWorkshopTimeSlots(params.location);
  const allWorkshops = getWorkshopsForLocation(params.location);
  const speakers = getSpeakersForLocation(params.location);
  return { location, timeSlots, allWorkshops, speakers };
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${period}` : `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

function getPrimaryWorkshop(
  slotKey: string,
  selections: ScheduleSelections,
  allWorkshops: WorkshopWithSchedule[]
): WorkshopWithSchedule | null {
  const primary = (selections[slotKey] ?? []).find((s) => s.type === "primary");
  if (!primary) return null;
  return allWorkshops.find((w) => w.id === primary.workshopId) ?? null;
}

export default function ComparePage({ loaderData }: Route.ComponentProps) {
  const { location, allWorkshops, speakers } = loaderData;

  return (
    <WorkshopModalProvider locationSlug={location.slug} allWorkshops={allWorkshops} speakers={speakers}>
      <ComparePageInner loaderData={loaderData} />
    </WorkshopModalProvider>
  );
}

function ComparePageInner({ loaderData }: { loaderData: Route.ComponentProps["loaderData"] }) {
  const { timeSlots, allWorkshops } = loaderData;
  const { userId, selections, selectWorkshop, importedSchedules, importSchedule, removeImportedSchedule, adoptSchedule, renameImportedSchedule } = useSchedule();
  const { openWorkshopModal, openSpeakerModal } = useWorkshopModal();

  const [importInput, setImportInput] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingShare, setPendingShare] = useState<SharedSchedule | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const selectionMap = useMemo(() => {
    const map = new Map<string, { slotKey: string; type: "primary" | "secondary" }>();
    for (const [slotKey, slotSelections] of Object.entries(selections)) {
      for (const sel of slotSelections) {
        map.set(sel.workshopId, { slotKey, type: sel.type });
      }
    }
    return map;
  }, [selections]);

  function handleImport() {
    try {
      // Accept either a full URL or just the base64 payload
      let encoded = importInput.trim();
      if (encoded.includes("?schedule=")) {
        encoded = new URL(encoded).searchParams.get("schedule") ?? encoded;
      }
      const decoded = decodeSchedule(encoded);
      setImportInput("");
      setImportError(null);
      setPendingShare(decoded);
    } catch {
      setImportError("Invalid share link. Please paste the full URL or encoded string.");
    }
  }

  function openRename(id: string, currentLabel: string) {
    setRenameTargetId(id);
    setRenameValue(currentLabel);
  }

  function handleRenameConfirm() {
    if (renameTargetId) renameImportedSchedule(renameTargetId, renameValue);
    setRenameTargetId(null);
  }

  const columns = [
    { id: userId, label: "My Schedule", selections, isOwn: true },
    ...importedSchedules.map((s) => ({
      id: s.userId,
      label: s.displayName ?? `User ${s.userId}`,
      selections: s.selections,
      isOwn: false,
      sharedAt: s.sharedAt,
    })),
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-57px)] overflow-hidden">
      {/* Import bar */}
      <div className="border-b px-4 py-3 flex items-start gap-2 shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex gap-2">
            <Input
              placeholder="Paste a share link…"
              value={importInput}
              onChange={(e) => { setImportInput(e.target.value); setImportError(null); }}
              onKeyDown={(e) => e.key === "Enter" && handleImport()}
              className="h-8 text-sm"
            />
            <Button size="sm" onClick={handleImport} disabled={!importInput.trim()} className="shrink-0 gap-1.5">
              <LinkIcon className="size-3.5" />
              Import
            </Button>
          </div>
          {importError && <p className="text-xs text-destructive mt-1">{importError}</p>}
        </div>
      </div>

      {/* Comparison grid */}
      {importedSchedules.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-8">
          <p className="text-sm font-medium">No schedules to compare yet</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            Ask a friend to share their schedule, then paste the link above to see your picks side by side.
          </p>
        </div>
      ) : (
      <div className="flex-1 overflow-auto">
          <table
            className="w-full table-fixed border-collapse text-xs"
            style={{ minWidth: `calc(7rem + ${columns.length} * 13rem)` }}
          >
            <thead className="sticky top-0 bg-background z-30 border-b">
              <tr>
                <th className="sticky left-0 z-20 bg-background text-left px-3 py-2 font-medium text-muted-foreground w-28 border-r whitespace-nowrap">
                  Time Slot
                </th>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className={cn(
                      "text-left px-3 py-2 font-medium border-r",
                      col.isOwn && "bg-muted/30"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold">{col.label}</div>
                        {"sharedAt" in col && col.sharedAt && (
                          <div className="text-[10px] text-muted-foreground font-normal">
                            Imported {new Date(col.sharedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      {!col.isOwn && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground hover:text-foreground shrink-0"
                            onClick={() => openRename(col.id, col.label)}
                            title="Rename"
                          >
                            <Pencil className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground hover:text-primary shrink-0"
                            onClick={() => adoptSchedule(col.id)}
                            title="Make this schedule my own"
                          >
                            <ArrowDownToLine className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => setDeleteTargetId(col.id)}
                            title="Remove this schedule"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((slot) => {
                const workshopsByCol = columns.map((col) =>
                  getPrimaryWorkshop(slot.key, col.selections, allWorkshops)
                );
                // Check if any two columns share the same primary workshop
                const workshopIds = workshopsByCol
                  .filter(Boolean)
                  .map((w) => w!.id);
                const hasMatch =
                  workshopIds.length > 1 &&
                  new Set(workshopIds).size < workshopIds.length;

                return (
                  <tr key={slot.key} className="border-b hover:bg-muted/20">
                    <td className="sticky left-0 z-10 bg-background px-3 py-2 text-muted-foreground border-r whitespace-nowrap align-top">
                      <div className="font-medium">{slot.day}</div>
                      <div>{formatTime(slot.startTime)}</div>
                    </td>
                    {columns.map((col, i) => {
                      const w = workshopsByCol[i];
                      const isMatch =
                        hasMatch &&
                        w &&
                        workshopsByCol.filter((other) => other?.id === w.id).length > 1;
                      const notInMySchedule = !col.isOwn && w && !selectionMap.has(w.id);

                      return (
                        <td
                          key={col.id}
                          className={cn(
                            "px-3 py-2 border-r align-top",
                            col.isOwn && "bg-muted/20",
                            isMatch && "bg-green-50"
                          )}
                        >
                          {w ? (
                            <div>
                              {w.trackSlug && (
                                <TrackBadge trackSlug={w.trackSlug} size="sm" className="mb-1" />
                              )}
                              <button
                                onClick={() => openWorkshopModal(w)}
                                className="font-medium leading-snug hover:underline text-left"
                              >
                                {w.title}
                              </button>
                              {w.speakerName && (
                                <button
                                  onClick={() => openSpeakerModal(w.speakerSlug)}
                                  className="block text-muted-foreground mt-0.5 hover:underline text-left"
                                >
                                  {w.speakerName}
                                </button>
                              )}
                              <div className="text-muted-foreground">{w.scheduleEntry.room}</div>
                              {notInMySchedule && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="mt-1.5 h-6 px-2 text-[10px] gap-1"
                                  onClick={() => {
                                    const hasPrimary = (selections[slot.key] ?? []).some((s) => s.type === "primary");
                                    selectWorkshop(slot.key, w.id, hasPrimary ? "secondary" : "primary");
                                  }}
                                  title="Add to my schedule"
                                >
                                  <Plus className="size-3" />
                                  Add
                                </Button>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
      </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              This imported schedule will be removed. You can re-import it using the original share link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTargetId) removeImportedSchedule(deleteTargetId);
                setDeleteTargetId(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename dialog */}
      <Dialog open={!!renameTargetId} onOpenChange={(open) => !open && setRenameTargetId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename schedule</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRenameConfirm()}
            placeholder="e.g. Alex's Schedule"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTargetId(null)}>Cancel</Button>
            <Button onClick={handleRenameConfirm}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import preview dialog */}
      <ImportScheduleDialog
        open={!!pendingShare}
        schedule={pendingShare}
        timeSlots={timeSlots}
        allWorkshops={allWorkshops}
        onConfirm={(displayName) => {
          if (pendingShare) importSchedule({ ...pendingShare, displayName });
          setPendingShare(null);
        }}
        onCancel={() => setPendingShare(null)}
      />
    </div>
  );
}
