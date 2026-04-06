import type {
  AppState,
  ScheduleSelections,
  SelectionType,
  SharedSchedule,
  WorkshopSelection,
} from "./types";

const STORAGE_KEY = "ghc-2026";

function generateUserId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

export function defaultState(): AppState {
  return {
    userId: generateUserId(),
    schedules: {},
    importedSchedules: [],
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const defaults = defaultState();
    return {
      userId: parsed.userId ?? defaults.userId,
      schedules: parsed.schedules ?? {},
      importedSchedules: parsed.importedSchedules ?? [],
    };
  } catch {
    return defaultState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable or full — silently fail
  }
}

// ── Schedule operations ───────────────────────────────────────────────────────

export function getScheduleForLocation(
  state: AppState,
  locationSlug: string
): ScheduleSelections {
  return state.schedules[locationSlug] ?? {};
}

export function setSelection(
  state: AppState,
  locationSlug: string,
  slotKey: string,
  workshopId: string,
  type: SelectionType
): AppState {
  const schedule = getScheduleForLocation(state, locationSlug);
  const slotSelections: WorkshopSelection[] = schedule[slotKey] ?? [];

  // Remove any existing entry for this workshop
  let updated = slotSelections.filter((s) => s.workshopId !== workshopId);

  if (type === "primary") {
    // Demote existing primary to secondary
    updated = updated.map((s) =>
      s.type === "primary" ? { ...s, type: "secondary" as SelectionType } : s
    );
    updated.unshift({ workshopId, type: "primary" });
  } else {
    updated.push({ workshopId, type: "secondary" });
  }

  return {
    ...state,
    schedules: {
      ...state.schedules,
      [locationSlug]: { ...schedule, [slotKey]: updated },
    },
  };
}

export function removeSelection(
  state: AppState,
  locationSlug: string,
  slotKey: string,
  workshopId: string
): AppState {
  const schedule = getScheduleForLocation(state, locationSlug);
  const original = schedule[slotKey] ?? [];
  const removedWasPrimary = original.find((s) => s.workshopId === workshopId)?.type === "primary";
  let remaining = original.filter((s) => s.workshopId !== workshopId);

  // Promote the first secondary to primary when the primary is removed
  if (removedWasPrimary && remaining.length > 0) {
    remaining = [
      { ...remaining[0], type: "primary" as SelectionType },
      ...remaining.slice(1),
    ];
  }

  return {
    ...state,
    schedules: {
      ...state.schedules,
      [locationSlug]: { ...schedule, [slotKey]: remaining },
    },
  };
}

export function promoteToPrimary(
  state: AppState,
  locationSlug: string,
  slotKey: string,
  workshopId: string
): AppState {
  return setSelection(state, locationSlug, slotKey, workshopId, "primary");
}

export function clearSchedule(state: AppState, locationSlug: string): AppState {
  const { [locationSlug]: _, ...rest } = state.schedules;
  return { ...state, schedules: rest };
}

// ── Import / export ───────────────────────────────────────────────────────────

export function importSchedule(
  state: AppState,
  incoming: SharedSchedule
): AppState {
  const previous = state.importedSchedules.find((s) => s.userId === incoming.userId);
  const merged: SharedSchedule = {
    ...incoming,
    // Preserve the existing label if the incoming payload doesn't carry one
    displayName: incoming.displayName ?? previous?.displayName,
  };
  const rest = state.importedSchedules.filter((s) => s.userId !== incoming.userId);
  return { ...state, importedSchedules: [...rest, merged] };
}

export function removeImportedSchedule(
  state: AppState,
  userId: string
): AppState {
  return {
    ...state,
    importedSchedules: state.importedSchedules.filter(
      (s) => s.userId !== userId
    ),
  };
}

export function adoptSchedule(
  state: AppState,
  locationSlug: string,
  sourceUserId: string
): AppState {
  const incoming = state.importedSchedules.find((s) => s.userId === sourceUserId);
  if (!incoming) return state;

  // Preserve current schedule as a labeled import before replacing
  const currentSelections = state.schedules[locationSlug] ?? {};
  const backupId = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const backup: SharedSchedule = {
    userId: backupId,
    locationSlug,
    selections: currentSelections,
    sharedAt: new Date().toISOString(),
    displayName: `Your schedule from ${new Date().toLocaleString()}`,
  };

  return {
    ...state,
    schedules: { ...state.schedules, [locationSlug]: incoming.selections },
    importedSchedules: [...state.importedSchedules, backup],
  };
}

export function renameImportedSchedule(
  state: AppState,
  userId: string,
  displayName: string
): AppState {
  return {
    ...state,
    importedSchedules: state.importedSchedules.map((s) =>
      s.userId === userId ? { ...s, displayName: displayName.trim() || undefined } : s
    ),
  };
}
