import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useSchedule } from "~/contexts/schedule-context";
import { WorkshopDetailModal } from "~/components/workshop-detail-modal";
import { SpeakerDetailModal } from "~/components/speaker-detail-modal";
import type { Speaker, WorkshopWithSchedule } from "~/lib/types";

interface WorkshopModalContextValue {
  openWorkshopModal: (workshop: WorkshopWithSchedule) => void;
  openSpeakerModal: (speakerSlug: string | null | undefined) => void;
}

const WorkshopModalContext = createContext<WorkshopModalContextValue | null>(null);

export function useWorkshopModal(): WorkshopModalContextValue {
  const ctx = useContext(WorkshopModalContext);
  if (!ctx) throw new Error("useWorkshopModal must be used within a WorkshopModalProvider");
  return ctx;
}

interface WorkshopModalProviderProps {
  locationSlug: string;
  allWorkshops: WorkshopWithSchedule[];
  speakers: Speaker[];
  children: ReactNode;
}

export function WorkshopModalProvider({
  locationSlug,
  allWorkshops,
  speakers,
  children,
}: WorkshopModalProviderProps) {
  const { selections, selectWorkshop, removeWorkshop } = useSchedule();

  const [workshopModal, setWorkshopModal] = useState<WorkshopWithSchedule | null>(null);
  const [speakerModal, setSpeakerModal] = useState<Speaker | null>(null);

  const selectionMap = useMemo(() => {
    const map = new Map<string, { slotKey: string; type: "primary" | "secondary" }>();
    for (const [slotKey, slotSelections] of Object.entries(selections)) {
      for (const sel of slotSelections) {
        map.set(sel.workshopId, { slotKey, type: sel.type });
      }
    }
    return map;
  }, [selections]);

  const speakerModalWorkshops = useMemo(() => {
    if (!speakerModal) return [];
    return allWorkshops.filter((w) => w.speakerSlug === speakerModal.slug);
  }, [speakerModal, allWorkshops]);

  function openSpeakerModal(speakerSlug: string | null | undefined) {
    if (!speakerSlug) return;
    const speaker = speakers.find((s) => s.slug === speakerSlug);
    if (speaker) setSpeakerModal(speaker);
  }

  const workshopModalSelection = workshopModal
    ? (selectionMap.get(workshopModal.id) ?? null)
    : null;

  return (
    <WorkshopModalContext.Provider value={{ openWorkshopModal: setWorkshopModal, openSpeakerModal }}>
      {children}

      <WorkshopDetailModal
        locationSlug={locationSlug}
        workshop={workshopModal}
        selectionType={workshopModalSelection?.type ?? null}
        onClose={() => setWorkshopModal(null)}
        onAdd={() => {
          if (!workshopModal) return;
          const slotKey = `${workshopModal.scheduleEntry.date}|${workshopModal.scheduleEntry.startTime}`;
          const hasPrimary = (selections[slotKey] ?? []).some((s) => s.type === "primary");
          selectWorkshop(slotKey, workshopModal.id, hasPrimary ? "secondary" : "primary");
        }}
        onRemove={() => {
          if (!workshopModal || !workshopModalSelection) return;
          removeWorkshop(workshopModalSelection.slotKey, workshopModal.id);
        }}
        onClickSpeaker={() => {
          if (workshopModal?.speakerSlug) {
            openSpeakerModal(workshopModal.speakerSlug);
            setWorkshopModal(null);
          }
        }}
      />

      <SpeakerDetailModal
        locationSlug={locationSlug}
        speaker={speakerModal}
        speakerWorkshops={speakerModalWorkshops}
        onClose={() => setSpeakerModal(null)}
        onClickWorkshop={(w) => {
          setSpeakerModal(null);
          setWorkshopModal(w);
        }}
      />
    </WorkshopModalContext.Provider>
  );
}
