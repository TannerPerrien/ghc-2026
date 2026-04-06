import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import type {
  AppState,
  ScheduleSelections,
  SelectionType,
  SharedSchedule,
} from "~/lib/types";
import {
  adoptSchedule as adoptScheduleStorage,
  clearSchedule,
  defaultState,
  getScheduleForLocation,
  importSchedule,
  loadState,
  promoteToPrimary,
  removeImportedSchedule,
  renameImportedSchedule,
  removeSelection,
  saveState,
  setSelection,
} from "~/lib/storage";

// ── Actions ───────────────────────────────────────────────────────────────────

type Action =
  | { type: "HYDRATE"; payload: AppState }
  | { type: "SELECT_WORKSHOP"; slotKey: string; workshopId: string; selectionType: SelectionType }
  | { type: "REMOVE_WORKSHOP"; slotKey: string; workshopId: string }
  | { type: "PROMOTE_TO_PRIMARY"; slotKey: string; workshopId: string }
  | { type: "CLEAR_SCHEDULE" }
  | { type: "IMPORT_SCHEDULE"; schedule: SharedSchedule }
  | { type: "REMOVE_IMPORTED_SCHEDULE"; userId: string }
  | { type: "ADOPT_SCHEDULE"; sourceUserId: string }
  | { type: "RENAME_IMPORTED_SCHEDULE"; userId: string; displayName: string };

function makeReducer(locationSlug: string) {
  return function reducer(state: AppState, action: Action): AppState {
    switch (action.type) {
      case "HYDRATE":
        return action.payload;
      case "SELECT_WORKSHOP":
        return setSelection(state, locationSlug, action.slotKey, action.workshopId, action.selectionType);
      case "REMOVE_WORKSHOP":
        return removeSelection(state, locationSlug, action.slotKey, action.workshopId);
      case "PROMOTE_TO_PRIMARY":
        return promoteToPrimary(state, locationSlug, action.slotKey, action.workshopId);
      case "CLEAR_SCHEDULE":
        return clearSchedule(state, locationSlug);
      case "IMPORT_SCHEDULE":
        return importSchedule(state, action.schedule);
      case "REMOVE_IMPORTED_SCHEDULE":
        return removeImportedSchedule(state, action.userId);
      case "ADOPT_SCHEDULE":
        return adoptScheduleStorage(state, locationSlug, action.sourceUserId);
      case "RENAME_IMPORTED_SCHEDULE":
        return renameImportedSchedule(state, action.userId, action.displayName);
      default:
        return state;
    }
  };
}

// ── Context ───────────────────────────────────────────────────────────────────

interface ScheduleContextValue {
  userId: string;
  selections: ScheduleSelections;
  importedSchedules: SharedSchedule[];
  selectWorkshop: (slotKey: string, workshopId: string, type: SelectionType) => void;
  removeWorkshop: (slotKey: string, workshopId: string) => void;
  promoteToPrimary: (slotKey: string, workshopId: string) => void;
  clearSchedule: () => void;
  importSchedule: (schedule: SharedSchedule) => void;
  removeImportedSchedule: (userId: string) => void;
  adoptSchedule: (sourceUserId: string) => void;
  renameImportedSchedule: (userId: string, displayName: string) => void;
}

const ScheduleContext = createContext<ScheduleContextValue | null>(null);

export function useSchedule(): ScheduleContextValue {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error("useSchedule must be used within a ScheduleProvider");
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

interface ScheduleProviderProps {
  locationSlug: string;
  children: ReactNode;
}

export function ScheduleProvider({ locationSlug, children }: ScheduleProviderProps) {
  const reducer = makeReducer(locationSlug);
  // Start with empty default state to match the prerendered HTML, then
  // hydrate from localStorage after mount to avoid a hydration mismatch.
  const [state, dispatch] = useReducer(reducer, undefined, defaultState);
  const hydrated = useRef(false);

  useEffect(() => {
    dispatch({ type: "HYDRATE", payload: loadState() });
  }, []);

  // Persist to localStorage after every change, but not before hydration
  // (which would overwrite saved data with the empty default state).
  // Skip the very first run (state = defaultState before HYDRATE is applied).
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    saveState(state);
  }, [state]);

  const selections = getScheduleForLocation(state, locationSlug);

  const value: ScheduleContextValue = {
    userId: state.userId,
    selections,
    importedSchedules: state.importedSchedules,
    selectWorkshop: (slotKey, workshopId, type) =>
      dispatch({ type: "SELECT_WORKSHOP", slotKey, workshopId, selectionType: type }),
    removeWorkshop: (slotKey, workshopId) =>
      dispatch({ type: "REMOVE_WORKSHOP", slotKey, workshopId }),
    promoteToPrimary: (slotKey, workshopId) =>
      dispatch({ type: "PROMOTE_TO_PRIMARY", slotKey, workshopId }),
    clearSchedule: () => dispatch({ type: "CLEAR_SCHEDULE" }),
    importSchedule: (schedule) => dispatch({ type: "IMPORT_SCHEDULE", schedule }),
    removeImportedSchedule: (userId) =>
      dispatch({ type: "REMOVE_IMPORTED_SCHEDULE", userId }),
    adoptSchedule: (sourceUserId) =>
      dispatch({ type: "ADOPT_SCHEDULE", sourceUserId }),
    renameImportedSchedule: (userId, displayName) =>
      dispatch({ type: "RENAME_IMPORTED_SCHEDULE", userId, displayName }),
  };

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
}
