import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { GhcEvent, ScheduleEntry } from '../types';

const LOCATION_SLUG = 'ohio';

// Day header → date + day name
const DAY_MAP: Record<string, { date: string; day: string }> = {
  'april 9': { date: '2026-04-09', day: 'Thursday' },
  'april 10': { date: '2026-04-10', day: 'Friday' },
  'april 11': { date: '2026-04-11', day: 'Saturday' },
};

// Known room names — used to distinguish workshop rows from event rows
const KNOWN_ROOMS = new Set([
  'Cincinnatus A', 'Cincinnatus B',
  'Room 230 ABC', 'Room 230 DEF', 'Room 230G', 'Room 230 H J',
  'Queen City A', 'Queen City B', 'Queen City C', 'Queen City D',
  'Room 201 ABC', 'Room 201D',
  'Room 210 ABC',
  'Room 221 AB',
  'Room 205 AB',
  'Room 211AB',
  'Room 232', 'Room 231', 'Room 204',
  'Ballroom', 'Room 310',
]);

function parseTime12to24(timeStr: string): string {
  // "2:30 PM" → "14:30", "8:00 AM" → "08:00", "11:30 - 12:30 PM" not handled here
  const match = timeStr.trim().match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!match) return timeStr;
  let hours = parseInt(match[1], 10);
  const mins = match[2];
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${mins}`;
}

function parseTimeSlot(slotStr: string): { startTime: string; endTime: string } | null {
  // "2:30 - 3:30 PM" or "9:30 - 11:30 AM" or "8:00 - 9:30 PM"
  const match = slotStr.trim().match(/^(\d+):(\d+)\s*-\s*(\d+):(\d+)\s*(AM|PM)$/i);
  if (!match) return null;
  const period = match[5].toUpperCase();
  const startHourRaw = parseInt(match[1], 10);
  const startMin = match[2];
  const endHourRaw = parseInt(match[3], 10);
  const endMin = match[4];

  // End time uses the stated period
  let endHour = endHourRaw;
  if (period === 'PM' && endHour !== 12) endHour += 12;
  if (period === 'AM' && endHour === 12) endHour = 0;
  const endTime = `${String(endHour).padStart(2, '0')}:${endMin}`;

  // Start time: if start hour (in PM sense) would be AFTER end hour, it must be AM
  // e.g. "8:00 - 9:30 PM" → start=8 PM = 20:00 which is > 21:30 if end=9:30 PM — wait no, 20 < 21, OK
  // e.g. "11:30 - 12:30 PM" → start=11 PM = 23, end=12 PM = 12 → 23 > 12, so start must be AM
  let startHour = startHourRaw;
  if (period === 'PM' && startHourRaw !== 12) {
    const startIfPm = startHourRaw + 12;
    // If start-as-PM would be after end, start must be AM (crosses noon)
    if (startIfPm > endHour) {
      // start is AM
      startHour = startHourRaw; // stays as-is (< 12)
    } else {
      startHour = startIfPm;
    }
  } else if (period === 'AM') {
    if (startHourRaw === 12) startHour = 0;
  }
  const startTime = `${String(startHour).padStart(2, '0')}:${startMin}`;

  return { startTime, endTime };
}

export interface ScheduleRow {
  room: string;
  speakerRaw: string;   // "Name (Organization)" as-is from CSV
  title: string;
  date: string;
  day: string;
  startTime: string;
  endTime: string;
}

export interface ParsedSchedule {
  workshopRows: ScheduleRow[];
  events: GhcEvent[];
}

export function parseScheduleCsv(csvPath: string): ParsedSchedule {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows: string[][] = parse(content, { relax_column_count: true, skip_empty_lines: false });

  const workshopRows: ScheduleRow[] = [];
  const events: GhcEvent[] = [];

  let currentDate = '';
  let currentDay = '';
  let currentStartTime = '';
  let currentEndTime = '';

  for (const row of rows) {
    const colA = (row[0] || '').trim();
    const colB = (row[1] || '').trim();
    const colC = (row[2] || '').trim();

    // Skip completely empty rows
    if (!colA && !colB && !colC) continue;

    // Day header: "April 9, Thursday" / "April 10, Friday" / "April 11, Saturday"
    const dayMatch = colA.match(/^(April \d+),\s*(Thursday|Friday|Saturday)$/i);
    if (dayMatch) {
      const key = dayMatch[1].toLowerCase();
      const dayInfo = DAY_MAP[key];
      if (dayInfo) {
        currentDate = dayInfo.date;
        currentDay = dayInfo.day;
        currentStartTime = '';
        currentEndTime = '';
      }
      continue;
    }

    // Time slot header: "2:30 - 3:30 PM"
    const slotMatch = colA.match(/^\d+:\d+\s*-\s*\d+:\d+\s*[AP]M$/i);
    if (slotMatch) {
      const parsed = parseTimeSlot(colA);
      if (parsed) {
        currentStartTime = parsed.startTime;
        currentEndTime = parsed.endTime;
      }
      continue;
    }

    // Single-time event in colA: "5:00 PM", "8:00 AM"
    const singleTimeMatch = colA.match(/^(\d+:\d+\s*[AP]M)$/i);
    if (singleTimeMatch && colB) {
      events.push({
        title: colB,
        locationSlug: LOCATION_SLUG,
        date: currentDate,
        day: currentDay,
        startTime: parseTime12to24(singleTimeMatch[1]),
        endTime: null,
        room: null,
        description: colC || null,
      });
      continue;
    }

    // Workshop row: colA is a known room name
    const normalizedRoom = colA.replace(/\s+/g, ' ');
    if (KNOWN_ROOMS.has(normalizedRoom)) {
      // Ballroom and Room 310 are always special events, not workshops
      if (normalizedRoom === 'Ballroom' || normalizedRoom === 'Room 310') {
        events.push({
          title: colB,
          locationSlug: LOCATION_SLUG,
          date: currentDate,
          day: currentDay,
          startTime: currentStartTime,
          endTime: currentEndTime,
          room: normalizedRoom,
          description: colC || null,
        });
        continue;
      }

      // Regular workshop room with a title in colC
      if (colC) {
        workshopRows.push({
          room: normalizedRoom,
          speakerRaw: colB,
          title: colC,
          date: currentDate,
          day: currentDay,
          startTime: currentStartTime,
          endTime: currentEndTime,
        });
        continue;
      }

      // Room row with no title — treat as event
      if (colB) {
        events.push({
          title: colB,
          locationSlug: LOCATION_SLUG,
          date: currentDate,
          day: currentDay,
          startTime: currentStartTime,
          endTime: currentEndTime,
          room: normalizedRoom,
          description: null,
        });
        continue;
      }
    }

    // Other non-empty rows (like "PRELIMINARY", legend rows, etc.) — skip
  }

  return { workshopRows, events };
}

// Normalize a title string for fuzzy matching
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    // Remove all apostrophe/quote variants (U+0027, U+2018, U+2019, U+201C, U+201D, U+0060, U+00B4)
    // Rather than replacing with apostrophe, remove entirely so "let's" = "lets" on both sides
    .replace(/[\u0027\u2018\u2019\u201C\u201D\u0060\u00B4]/g, '')
    // Replace all non-alphanumeric chars (except spaces) with a space
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordSet(normalized: string): Set<string> {
  return new Set(normalized.split(' ').filter(Boolean));
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = wordSet(a);
  const setB = wordSet(b);
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

// Maps normalized CSV title → workshop slug(s).
// Used when the CSV title diverges from the API title enough to defeat fuzzy matching.
const TITLE_OVERRIDES = new Map<string, string[]>([
  ['charlotte mason excellence without sacrifice',
    ['a-charlotte-mason-education-excellence-without-sacrifice']],
  ['all the questions youre afraid to ask about marriage',
    ['all-the-questions-youre-afraid-to-ask-about-marriage']],
  // Same CSV row covers two co-speaker workshops with identical API titles:
  ['anchoring on your why when times get tough',
    [
      'anchoring-on-your-why-when-times-get-tough-from-teaching-neurodivergent-students-to-lifes-difficult-seasons',
      'anchoring-on-your-why-when-times-get-tough-from-teaching-neurodivergent-students-to-lifes-difficult-seasons-2',
    ]],
  ['behind the scenes of storytelling for 5 8 grade students',
    ['behind-the-scenes-of-storytelling-designed-for-5th-8th-grade-students']],
  ['beyond adhd symptoms strategies to treat the whole child',
    ['beyond-adhd-symptoms-exploring-causes-understanding-holistic-treatments-and-mastering-learning-strategies-to-treat-the-whole-child']],
  ['homeschooling twice exceptional children',
    ['homeschooling-twice-exceptional-children']],
  ['ez 1 iews step by step teaching method',
    ['ez-1-the-iew-method-of-teaching']],
  // API title has a typo ("Homescholing"), CSV spells it correctly:
  ['five flavors of homeschooling',
    ['five-flavors-of-homescholing']],
  ['for those moments when you dont like your child but you still love them',
    ['for-those-moments-when-you-dont-like-your-child-but-you-still-love-them']],
  ['hacking high school and college',
    ['hacking-high-school-and-college']],
  ['ice cream with authors live a special podcast experience for families ice cream not included',
    ['ice-cream-with-authors-live-a-special-podcast-experience-for-families-2']],
  // API title has a typo ("Lauching"), CSV spells it correctly:
  ['launching your homeschool journey success for the road',
    ['lauching-your-homeschool-journey-success-for-the-road']],
  ['martin and andrew reflect on great childrens literature',
    ['andrew-and-martin-argue-about-good-and-great-books']],
  ['foundational five bible stories fairy tales mother goose aesop mythology',
    ['the-foundational-five-bible-stories-fairy-tales-mother-goose-aesops-fables-and-mythology']],
  ['michael clay thompson language arts charlotte mason',
    ['the-michael-clay-thompson-approach-to-english-language-arts-mastery']],
  ['americas miraculous story evidence of gods hand',
    ['the-miraculous-history-of-america-gods-hand-on-us']],
  ['twelve great christian novels and why you should read them',
    ['twelve-great-books-for-boys']],
  ['we must raise ladies and gentlemen who live with honor',
    ['we-must-raise-honorable-ladies-gentlemen']],
]);

export function matchWorkshopRows(
  workshopRows: ScheduleRow[],
  workshopsBySlug: Map<string, { id: string; slug: string; title: string }>
): {
  matched: Array<{ slug: string; entry: ScheduleEntry; room: string; speakerRaw: string }>;
  unmatched: ScheduleRow[];
} {
  // Build normalized title → slug lookup
  const titleToSlug = new Map<string, string>();
  const normalizedApiTitles: Array<{ norm: string; slug: string }> = [];
  for (const [slug, w] of workshopsBySlug) {
    const norm = normalizeTitle(w.title);
    titleToSlug.set(norm, slug);
    normalizedApiTitles.push({ norm, slug });
  }

  const matched: Array<{ slug: string; entry: ScheduleEntry; room: string; speakerRaw: string }> = [];
  const unmatched: ScheduleRow[] = [];

  for (const row of workshopRows) {
    const normTitle = normalizeTitle(row.title);

    // Check manual overrides first — handles renamed/shortened CSV titles
    const overrideSlugs = TITLE_OVERRIDES.get(normTitle);
    if (overrideSlugs) {
      for (const s of overrideSlugs) {
        matched.push({
          slug: s,
          entry: { date: row.date, day: row.day, startTime: row.startTime, endTime: row.endTime, room: row.room },
          room: row.room,
          speakerRaw: row.speakerRaw,
        });
      }
      continue;
    }

    let slug = titleToSlug.get(normTitle);

    // Fuzzy fallback: find best Jaccard match above threshold
    if (!slug) {
      let bestScore = 0;
      let bestSlug: string | null = null;
      for (const { norm, slug: apiSlug } of normalizedApiTitles) {
        const score = jaccardSimilarity(normTitle, norm);
        if (score > bestScore) {
          bestScore = score;
          bestSlug = apiSlug;
        }
      }
      // Require >= 0.70 similarity and the first word must match
      // (prevents matching totally different workshops that share some common words)
      if (bestScore >= 0.70 && bestSlug) {
        const csvFirstWord = normTitle.split(' ')[0];
        const apiFirstWord = normalizeTitle(workshopsBySlug.get(bestSlug)!.title).split(' ')[0];
        if (csvFirstWord === apiFirstWord) {
          slug = bestSlug;
        }
      }
    }

    if (slug) {
      matched.push({
        slug,
        entry: {
          date: row.date,
          day: row.day,
          startTime: row.startTime,
          endTime: row.endTime,
          room: row.room,
        },
        room: row.room,
        speakerRaw: row.speakerRaw,
      });
    } else {
      unmatched.push(row);
    }
  }

  return { matched, unmatched };
}
