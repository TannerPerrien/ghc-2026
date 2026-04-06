export interface TrackTheme {
  name: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
}

export const TRACK_THEMES: Record<string, TrackTheme> = {
  "charlotte-mason": {
    name: "Charlotte Mason",
    bg: "bg-amber-100",
    text: "text-amber-800",
    border: "border-amber-300",
    dot: "bg-amber-500",
  },
  classical: {
    name: "Classical",
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-300",
    dot: "bg-blue-500",
  },
  college: {
    name: "College",
    bg: "bg-indigo-100",
    text: "text-indigo-800",
    border: "border-indigo-300",
    dot: "bg-indigo-500",
  },
  "homeschool-101": {
    name: "Homeschool 101",
    bg: "bg-green-100",
    text: "text-green-800",
    border: "border-green-300",
    dot: "bg-green-500",
  },
  "homesteading-homeschooling": {
    name: "Homesteading",
    bg: "bg-lime-100",
    text: "text-lime-800",
    border: "border-lime-300",
    dot: "bg-lime-600",
  },
  "neurodivergent-learning": {
    name: "Neurodivergent",
    bg: "bg-purple-100",
    text: "text-purple-800",
    border: "border-purple-300",
    dot: "bg-purple-500",
  },
  "parent-to-parent": {
    name: "Parent-to-Parent",
    bg: "bg-rose-100",
    text: "text-rose-800",
    border: "border-rose-300",
    dot: "bg-rose-500",
  },
  "real-faith-teen": {
    name: "Real Faith Teen",
    bg: "bg-orange-100",
    text: "text-orange-800",
    border: "border-orange-300",
    dot: "bg-orange-500",
  },
  "special-needs": {
    name: "Special Needs",
    bg: "bg-teal-100",
    text: "text-teal-800",
    border: "border-teal-300",
    dot: "bg-teal-500",
  },
  teen: {
    name: "Teen Track",
    bg: "bg-cyan-100",
    text: "text-cyan-800",
    border: "border-cyan-300",
    dot: "bg-cyan-500",
  },
};

export function getTrackTheme(trackSlug: string | null | undefined): TrackTheme | null {
  if (!trackSlug) return null;
  return TRACK_THEMES[trackSlug] ?? null;
}
