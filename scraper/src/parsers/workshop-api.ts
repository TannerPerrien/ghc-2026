import * as cheerio from 'cheerio';
import { WorkshopStub } from '../types';

interface ApiWorkshopRow {
  id: string;
  title: string;    // HTML containing <a> with href and data-title
  speaker: string;  // HTML containing <a> with href and data-title
  track: string;
  timelocation: string;
}

interface ApiResponse {
  data: ApiWorkshopRow[];
}

function extractLink(html: string): { text: string; slug: string | null } {
  if (!html || html.trim() === '') return { text: '', slug: null };
  const $ = cheerio.load(html);
  const a = $('a').first();
  if (!a.length) return { text: $.text().trim(), slug: null };

  // Prefer text content over data-title attribute because the API HTML uses single-quote
  // attribute values and unescaped apostrophes in titles cause data-title to be truncated.
  const text = (a.text() || a.attr('data-title') || '').trim();
  const href = a.attr('href') || '';
  // href may be absolute (https://...com/workshops/slug) or relative (/workshops/slug)
  const match = href.match(/\/workshops\/([^/?#]+)|\/speakers\/([^/?#]+)/);
  const slug = match ? (match[1] || match[2]) : (href.split('/').filter(Boolean).pop() || null);
  return { text, slug };
}

export function parseWorkshopApi(json: ApiResponse): WorkshopStub[] {
  const stubs: WorkshopStub[] = [];

  for (const row of json.data) {
    const { text: title, slug: workshopSlug } = extractLink(row.title);
    const { text: speakerName, slug: speakerSlug } = extractLink(row.speaker);

    if (!workshopSlug || !title) continue;

    stubs.push({
      id: row.id,
      slug: workshopSlug,
      title,
      speakerSlug: speakerSlug || null,
      speakerName: speakerName || null,
      trackName: row.track?.trim() || null,
    });
  }

  return stubs;
}
