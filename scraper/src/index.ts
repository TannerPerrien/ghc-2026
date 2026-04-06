import fs from 'fs';
import path from 'path';
import pLimit from 'p-limit';
import { fetchText, fetchJson, setFresh } from './utils/fetch';
import { parseWorkshopApi } from './parsers/workshop-api';
import { parseSpeakerList } from './parsers/speaker-list';
import { parseSpeakerDetail } from './parsers/speaker-detail';
import { parseWorkshopDetail } from './parsers/workshop-detail';
import { parseScheduleCsv, matchWorkshopRows } from './parsers/schedule-csv';
import { Location, Track, Speaker, Workshop, GhcEvent, WorkshopStub, SpeakerStub } from './types';

const DATA_DIR = path.join(__dirname, '../../data');
const CSV_PATH = path.join(__dirname, '../../2026 OH Program Guide - Sheet1.csv');
const CONCURRENCY = 5;

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
  const apiData = await fetchJson<{ data: any[] }>('/api/workshops-ohio.json');
  const workshopStubs = parseWorkshopApi(apiData);
  console.log(`  ${workshopStubs.length} workshops parsed`);

  // Build deduped workshop map by id
  const workshopMap = new Map<string, WorkshopStub>();
  for (const stub of workshopStubs) {
    if (!workshopMap.has(stub.id)) workshopMap.set(stub.id, stub);
  }

  // Collect all speaker slugs mentioned in workshops
  const speakerSlugsFromApi = new Set<string>(
    Array.from(workshopMap.values())
      .map(w => w.speakerSlug)
      .filter((s): s is string => s !== null)
  );

  console.log('\n=== Phase 2: Speaker Listing ===');
  const speakerListHtml = await fetchText('/locations/ohio/speakers');
  const speakerListStubs = parseSpeakerList(speakerListHtml);
  console.log(`  ${speakerListStubs.length} speakers found on listing page`);

  // Merge speaker stubs: listing page + API
  const speakerStubMap = new Map<string, SpeakerStub>();
  for (const stub of speakerListStubs) {
    speakerStubMap.set(stub.slug, stub);
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

  console.log('\n=== Phase 5: Parse Schedule CSV ===');
  const { workshopRows, events: csvEvents } = parseScheduleCsv(CSV_PATH);
  console.log(`  ${workshopRows.length} workshop rows in CSV`);
  console.log(`  ${csvEvents.length} event rows in CSV`);

  const { matched, unmatched } = matchWorkshopRows(
    workshopRows,
    new Map(Array.from(workshopMap.values()).map(w => [w.slug, { id: w.id, slug: w.slug, title: w.title }]))
  );
  console.log(`  ${matched.length} CSV rows matched to workshops`);
  if (unmatched.length > 0) {
    console.warn(`  WARN: ${unmatched.length} CSV rows could not be matched:`);
    for (const row of unmatched) {
      console.warn(`    - "${row.title}" by ${row.speakerRaw}`);
    }
  }

  console.log('\n=== Phase 6: Reconciliation & Output ===');

  // Build locations.json
  const locations: Location[] = [
    {
      slug: 'ohio',
      name: 'Ohio',
      abbreviation: 'OH',
      venue: 'First Financial Center',
      city: 'Cincinnati',
      address: '525 Elm St, Cincinnati, OH 45202',
      dates: { start: '2026-04-09', end: '2026-04-11' },
      year: 2026,
    },
  ];

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

  // Build schedule lookup: workshop slug → ScheduleEntry
  const scheduleBySlug = new Map<string, { date: string; day: string; startTime: string; endTime: string; room: string }>();
  for (const m of matched) {
    scheduleBySlug.set(m.slug, m.entry);
  }

  // Build workshops.json
  const workshops: Workshop[] = [];
  for (const stub of workshopMap.values()) {
    const detail = workshopDetailMap.get(stub.slug);
    const scheduleEntry = scheduleBySlug.get(stub.slug);

    // locationSlugs: prefer detail page (authoritative) over API
    const locationSlugs = detail?.locationSlugs.length
      ? detail.locationSlugs
      : ['ohio']; // fallback: if we scraped it from Ohio API, it's at Ohio

    const workshop: Workshop = {
      id: stub.id,
      slug: stub.slug,
      title: stub.title,
      speakerSlug: stub.speakerSlug,
      speakerName: stub.speakerName,
      trackSlug: trackNameToSlug(stub.trackName || '') || null,
      locationSlugs,
      description: detail?.description || null,
      schedule: scheduleEntry ? { ohio: scheduleEntry } : {},
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

  const scheduledCount = workshops.filter(w => Object.keys(w.schedule).length > 0).length;
  console.log(`  ${scheduledCount}/${workshops.length} workshops have Ohio schedule data`);

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
  write('events.json', csvEvents);

  console.log('\n=== Done ===');
  console.log(`  ${locations.length} locations`);
  console.log(`  ${tracks.length} tracks`);
  console.log(`  ${speakers.length} speakers`);
  console.log(`  ${workshops.length} workshops`);
  console.log(`  ${csvEvents.length} events`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
