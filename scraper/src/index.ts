import fs from 'fs';
import path from 'path';
import pLimit from 'p-limit';
import { fetchText, fetchJson, setFresh } from './utils/fetch';
import { parseWorkshopApi } from './parsers/workshop-api';
import { parseSpeakerList } from './parsers/speaker-list';
import { parseSpeakerDetail } from './parsers/speaker-detail';
import { parseWorkshopDetail } from './parsers/workshop-detail';
import { parseScheduleCsv, matchWorkshopRows } from './parsers/schedule-csv';
import { Location, Track, Speaker, Workshop, GhcEvent, WorkshopStub, SpeakerStub, ScheduleEntry } from './types';

const DATA_DIR = path.join(__dirname, '../../data');
const CONCURRENCY = 5;

interface LocationConfig {
  slug: string;
  name: string;
  abbreviation: string;
  venue: string;
  city: string;
  address: string;
  dates: { start: string; end: string };
  year: number;
  apiPath: string;
  speakerListPath: string;
  csvFilename: string | null;
  csvDayMap: Record<string, { date: string; day: string }>;
  csvKnownRooms: Set<string>;
  csvEventRooms: Set<string>;
}

const LOCATION_CONFIGS: LocationConfig[] = [
  {
    slug: 'ohio',
    name: 'Ohio',
    abbreviation: 'OH',
    venue: 'First Financial Center',
    city: 'Cincinnati',
    address: '525 Elm St, Cincinnati, OH 45202',
    dates: { start: '2026-04-09', end: '2026-04-11' },
    year: 2026,
    apiPath: '/api/workshops-ohio.json',
    speakerListPath: '/locations/ohio/speakers',
    csvFilename: '2026 OH Program Guide - Sheet1.csv',
    csvDayMap: {
      'april 9': { date: '2026-04-09', day: 'Thursday' },
      'april 10': { date: '2026-04-10', day: 'Friday' },
      'april 11': { date: '2026-04-11', day: 'Saturday' },
    },
    csvKnownRooms: new Set([
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
    ]),
    csvEventRooms: new Set(['Ballroom', 'Room 310']),
  },
  {
    slug: 'texas',
    name: 'Texas',
    abbreviation: 'TX',
    venue: 'Kalahari Resorts & Conventions Center',
    city: 'Round Rock',
    address: '3001 Kalahari Blvd, Round Rock, TX 78665',
    dates: { start: '2026-07-09', end: '2026-07-11' },
    year: 2026,
    apiPath: '/api/workshops-texas.json',
    speakerListPath: '/locations/texas/speakers',
    csvFilename: null,
    csvDayMap: {},
    csvKnownRooms: new Set(),
    csvEventRooms: new Set(),
  },
  {
    slug: 'california',
    name: 'California',
    abbreviation: 'CA',
    venue: 'Ontario Convention Center',
    city: 'Ontario',
    address: '2000 E Convention Center Way, Ontario, CA 91764',
    dates: { start: '2026-06-18', end: '2026-06-20' },
    year: 2026,
    apiPath: '/api/workshops-california.json',
    speakerListPath: '/locations/california/speakers',
    csvFilename: null,
    csvDayMap: {},
    csvKnownRooms: new Set(),
    csvEventRooms: new Set(),
  },
];

// Track name → slug mapping
const TRACK_NAME_TO_SLUG: Record<string, string> = {
  'charlotte mason track': 'charlotte-mason',
  'charlotte mason': 'charlotte-mason',
  'classical track': 'classical',
  'classical': 'classical',
  'college track': 'college',
  'college': 'college',
  'homeschool 101': 'homeschool-101',
  'homesteading & homeschooling': 'homesteading-homeschooling',
  'homesteading track': 'homesteading-homeschooling',
  'homesteading': 'homesteading-homeschooling',
  'neurodivergent learning': 'neurodivergent-learning',
  'neurodivergent': 'neurodivergent-learning',
  'parent-to-parent track': 'parent-to-parent',
  'parent-to-parent': 'parent-to-parent',
  'real faith for the real world teen track': 'real-faith-teen',
  'teen track': 'teen',
  'teen': 'teen',
  'special needs': 'special-needs',
};

function trackNameToSlug(name: string): string | null {
  return TRACK_NAME_TO_SLUG[name.toLowerCase().trim()] || null;
}

async function main() {
  const fresh = process.argv.includes('--fresh');
  setFresh(fresh);

  fs.mkdirSync(DATA_DIR, { recursive: true });

  console.log('\n=== Phase 1: Workshop API ===');
  const workshopMap = new Map<string, WorkshopStub>();
  // Track which location APIs each workshop was found in (for fallback locationSlugs)
  const workshopSourceLocations = new Map<string, string[]>();

  for (const loc of LOCATION_CONFIGS) {
    console.log(`  Fetching ${loc.apiPath}...`);
    try {
      const apiData = await fetchJson<{ data: any[] }>(loc.apiPath);
      const stubs = parseWorkshopApi(apiData);
      console.log(`  ${stubs.length} workshops from ${loc.name}`);
      for (const stub of stubs) {
        if (!workshopMap.has(stub.id)) workshopMap.set(stub.id, stub);
        const sources = workshopSourceLocations.get(stub.id) ?? [];
        sources.push(loc.slug);
        workshopSourceLocations.set(stub.id, sources);
      }
    } catch (err) {
      console.warn(`  WARN: Failed to fetch ${loc.apiPath}: ${err}`);
    }
  }
  console.log(`  ${workshopMap.size} unique workshops total`);

  // Collect all speaker slugs mentioned in workshops
  const speakerSlugsFromApi = new Set<string>(
    Array.from(workshopMap.values())
      .map(w => w.speakerSlug)
      .filter((s): s is string => s !== null)
  );

  console.log('\n=== Phase 2: Speaker Listing ===');
  const speakerStubMap = new Map<string, SpeakerStub>();

  for (const loc of LOCATION_CONFIGS) {
    console.log(`  Fetching ${loc.speakerListPath}...`);
    try {
      const html = await fetchText(loc.speakerListPath);
      const stubs = parseSpeakerList(html);
      console.log(`  ${stubs.length} speakers from ${loc.name}`);
      for (const stub of stubs) {
        if (!speakerStubMap.has(stub.slug)) speakerStubMap.set(stub.slug, stub);
      }
    } catch (err) {
      console.warn(`  WARN: Failed to fetch ${loc.speakerListPath}: ${err}`);
    }
  }

  // Add any speaker slugs from the API that aren't in the listing
  for (const slug of speakerSlugsFromApi) {
    if (!speakerStubMap.has(slug)) {
      speakerStubMap.set(slug, { slug, name: '', photoFilename: null });
    }
  }
  console.log(`  ${speakerStubMap.size} unique speakers total`);

  console.log('\n=== Phase 3: Speaker Detail Pages ===');
  const limit = pLimit(CONCURRENCY);
  const speakerDetails = new Map<string, ReturnType<typeof parseSpeakerDetail>>();

  await Promise.all(
    Array.from(speakerStubMap.keys()).map(slug =>
      limit(async () => {
        const html = await fetchText(`/speakers/${slug}`);
        speakerDetails.set(slug, parseSpeakerDetail(html));
      })
    )
  );
  console.log(`  ${speakerDetails.size} speaker detail pages processed`);

  console.log('\n=== Phase 4: Workshop Detail Pages ===');
  const workshopDetailMap = new Map<string, ReturnType<typeof parseWorkshopDetail>>();
  const workshopSlugSet = new Set(Array.from(workshopMap.values()).map(w => w.slug));

  await Promise.all(
    Array.from(workshopSlugSet).map(slug =>
      limit(async () => {
        try {
          const html = await fetchText(`/workshops/${slug}`);
          workshopDetailMap.set(slug, parseWorkshopDetail(html));
        } catch (err) {
          console.warn(`  WARN: Failed to fetch /workshops/${slug}: ${err}`);
        }
      })
    )
  );
  console.log(`  ${workshopDetailMap.size} workshop detail pages processed`);

  console.log('\n=== Phase 5: Parse Schedule CSVs ===');
  // scheduleByLocation: locationSlug → (workshopSlug → ScheduleEntry)
  const scheduleByLocation = new Map<string, Map<string, ScheduleEntry>>();
  const allEvents: GhcEvent[] = [];

  // Build slug lookup for matchWorkshopRows
  const workshopsBySlug = new Map(
    Array.from(workshopMap.values()).map(w => [w.slug, { id: w.id, slug: w.slug, title: w.title }])
  );

  for (const loc of LOCATION_CONFIGS) {
    if (!loc.csvFilename) continue;
    const csvPath = path.join(__dirname, '../../', loc.csvFilename);
    if (!fs.existsSync(csvPath)) {
      console.warn(`  WARN: CSV not found for ${loc.name} (${loc.csvFilename}), skipping schedule`);
      continue;
    }

    console.log(`  Parsing ${loc.csvFilename}...`);
    const { workshopRows, events } = parseScheduleCsv(
      csvPath,
      loc.slug,
      loc.csvDayMap,
      loc.csvKnownRooms,
      loc.csvEventRooms,
    );
    console.log(`  ${workshopRows.length} workshop rows, ${events.length} event rows from ${loc.name}`);
    allEvents.push(...events);

    const { matched, unmatched } = matchWorkshopRows(workshopRows, workshopsBySlug);
    console.log(`  ${matched.length} CSV rows matched to workshops`);
    if (unmatched.length > 0) {
      console.warn(`  WARN: ${unmatched.length} CSV rows could not be matched (${loc.name}):`);
      for (const row of unmatched) {
        console.warn(`    - "${row.title}" by ${row.speakerRaw}`);
      }
    }

    const locMap = new Map<string, ScheduleEntry>();
    for (const m of matched) locMap.set(m.slug, m.entry);
    scheduleByLocation.set(loc.slug, locMap);
  }

  console.log('\n=== Phase 6: Reconciliation & Output ===');

  // Build locations.json from config
  const locations: Location[] = LOCATION_CONFIGS.map(({ slug, name, abbreviation, venue, city, address, dates, year }) =>
    ({ slug, name, abbreviation, venue, city, address, dates, year })
  );

  // Build tracks.json — discover all track names from the API
  const trackNamesFound = new Set<string>();
  for (const stub of workshopMap.values()) {
    if (stub.trackName) trackNamesFound.add(stub.trackName);
  }
  const tracksMap = new Map<string, Track>();
  for (const name of trackNamesFound) {
    const slug = trackNameToSlug(name);
    if (slug && !tracksMap.has(slug)) {
      tracksMap.set(slug, { slug, name });
    }
  }
  // Ensure all known tracks are present
  const knownTracks: Track[] = [
    { slug: 'charlotte-mason', name: 'Charlotte Mason Track' },
    { slug: 'classical', name: 'Classical Track' },
    { slug: 'college', name: 'College Track' },
    { slug: 'homeschool-101', name: 'Homeschool 101' },
    { slug: 'homesteading-homeschooling', name: 'Homesteading & Homeschooling' },
    { slug: 'neurodivergent-learning', name: 'Neurodivergent Learning' },
    { slug: 'parent-to-parent', name: 'Parent-to-Parent Track' },
    { slug: 'real-faith-teen', name: 'Real Faith for the Real World Teen Track' },
    { slug: 'special-needs', name: 'Special Needs' },
    { slug: 'teen', name: 'Teen Track' },
  ];
  for (const t of knownTracks) {
    if (!tracksMap.has(t.slug)) tracksMap.set(t.slug, t);
  }
  const tracks = Array.from(tracksMap.values()).sort((a, b) => a.slug.localeCompare(b.slug));

  // Build workshops.json
  const workshops: Workshop[] = [];
  for (const stub of workshopMap.values()) {
    const detail = workshopDetailMap.get(stub.slug);

    // locationSlugs: prefer detail page (authoritative); fall back to all API source locations
    const locationSlugs = detail?.locationSlugs.length
      ? detail.locationSlugs
      : (workshopSourceLocations.get(stub.id) ?? ['ohio']);

    // schedule: collect entries from all location CSVs
    const schedule: Record<string, ScheduleEntry> = {};
    for (const [locSlug, locMap] of scheduleByLocation) {
      const entry = locMap.get(stub.slug);
      if (entry) schedule[locSlug] = entry;
    }

    const workshop: Workshop = {
      id: stub.id,
      slug: stub.slug,
      title: stub.title,
      speakerSlug: stub.speakerSlug,
      speakerName: stub.speakerName,
      trackSlug: trackNameToSlug(stub.trackName || '') || null,
      locationSlugs,
      description: detail?.description || null,
      schedule,
    };
    workshops.push(workshop);
  }

  // Sort workshops by title for stable output
  workshops.sort((a, b) => a.title.localeCompare(b.title));

  // Build speakers.json
  const speakers: Speaker[] = [];
  for (const [slug, stub] of speakerStubMap) {
    const detail = speakerDetails.get(slug);
    if (!detail) continue;

    const speaker: Speaker = {
      slug,
      name: detail.name || stub.name,
      title: detail.title,
      website: detail.website,
      photoFilename: detail.photoFilename || stub.photoFilename,
      bio: detail.bio,
      locationSlugs: detail.locationSlugs,
      trackSlugs: detail.trackSlugs,
      workshopSlugs: detail.workshopSlugs,
    };
    speakers.push(speaker);
  }

  // Sort speakers by name
  speakers.sort((a, b) => a.name.localeCompare(b.name));

  // Reconciliation checks
  const workshopSlugIndex = new Map(workshops.map(w => [w.slug, w]));
  const speakerSlugIndex = new Map(speakers.map(s => [s.slug, s]));

  let missingWorkshops = 0;
  for (const speaker of speakers) {
    for (const wSlug of speaker.workshopSlugs) {
      if (!workshopSlugIndex.has(wSlug)) {
        missingWorkshops++;
      }
    }
  }
  if (missingWorkshops > 0) {
    console.warn(`  WARN: ${missingWorkshops} speaker->workshop references not found in workshops.json`);
  }

  let missingSpeakers = 0;
  for (const workshop of workshops) {
    if (workshop.speakerSlug && !speakerSlugIndex.has(workshop.speakerSlug)) {
      missingSpeakers++;
    }
  }
  if (missingSpeakers > 0) {
    console.warn(`  WARN: ${missingSpeakers} workshop->speaker references not found in speakers.json`);
  }

  for (const loc of LOCATION_CONFIGS) {
    const locScheduled = workshops.filter(w => loc.slug in w.schedule).length;
    console.log(`  ${locScheduled}/${workshops.length} workshops have ${loc.name} schedule data`);
  }

  // Write output files
  const write = (filename: string, data: unknown) => {
    const filepath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`  Written: ${filename}`);
  };

  write('locations.json', locations);
  write('tracks.json', tracks);
  write('speakers.json', speakers);
  write('workshops.json', workshops);
  write('events.json', allEvents);

  console.log('\n=== Done ===');
  console.log(`  ${locations.length} locations`);
  console.log(`  ${tracks.length} tracks`);
  console.log(`  ${speakers.length} speakers`);
  console.log(`  ${workshops.length} workshops`);
  console.log(`  ${allEvents.length} events`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
