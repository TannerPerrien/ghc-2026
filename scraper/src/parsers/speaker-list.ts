import * as cheerio from 'cheerio';
import { SpeakerStub } from '../types';

function extractPhotoFilename(src: string): string | null {
  if (!src) return null;
  // Strip Craft CMS transform prefix like /_WxH_crop_center-center_90_none/
  // URL looks like: /images/speakers/_600x600_crop_center-center_90_none/filename.jpg
  const match = src.match(/\/([^/]+)$/);
  return match ? match[1] : null;
}

export function parseSpeakerList(html: string): SpeakerStub[] {
  const $ = cheerio.load(html);
  const stubs: SpeakerStub[] = [];

  // Speaker cards: each is an <a> linking to /speakers/{slug}
  $('a[href^="/speakers/"]').each((_, el) => {
    const a = $(el);
    const href = a.attr('href') || '';
    const slug = href.split('/').filter(Boolean).pop();
    if (!slug) return;

    const name = a.find('span').first().text().trim() || a.text().trim();
    const imgSrc = a.find('img').attr('src') || '';
    const photoFilename = extractPhotoFilename(imgSrc);

    if (slug && name) {
      stubs.push({ slug, name, photoFilename });
    }
  });

  // Deduplicate by slug (same speaker may appear in multiple grid positions)
  const seen = new Set<string>();
  return stubs.filter(s => {
    if (seen.has(s.slug)) return false;
    seen.add(s.slug);
    return true;
  });
}
