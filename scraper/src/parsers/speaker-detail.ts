import * as cheerio from 'cheerio';

const STATE_TO_SLUG: Record<string, string> = {
  SC: 'south-carolina',
  MO: 'missouri',
  OH: 'ohio',
  CA: 'california',
  TX: 'texas',
};

const TRACK_NAME_TO_SLUG: Record<string, string> = {
  'charlotte mason': 'charlotte-mason',
  'charlotte mason track': 'charlotte-mason',
  'classical': 'classical',
  'classical track': 'classical',
  'college': 'college',
  'college track': 'college',
  'homeschool 101': 'homeschool-101',
  'homesteading': 'homesteading-homeschooling',
  'homesteading & homeschooling': 'homesteading-homeschooling',
  'homesteading track': 'homesteading-homeschooling',
  'neurodivergent': 'neurodivergent-learning',
  'neurodivergent learning': 'neurodivergent-learning',
  'parent-to-parent': 'parent-to-parent',
  'parent-to-parent track': 'parent-to-parent',
  'real faith': 'real-faith-teen',
  'real faith for the real world teen track': 'real-faith-teen',
  'teen track': 'teen',
  'teen': 'teen',
  'special needs': 'special-needs',
};

function extractPhotoFilename(src: string): string | null {
  if (!src) return null;
  const match = src.match(/\/([^/?#]+\.(jpg|jpeg|png|webp|gif))(\?|#|$)/i);
  return match ? match[1] : null;
}

function workshopSlugFromHref(href: string): string | null {
  // Handles both relative (/workshops/slug) and absolute (https://...com/workshops/slug) URLs
  const match = href.match(/\/workshops\/([^/?#]+)/);
  return match ? match[1] : null;
}

export interface SpeakerDetail {
  name: string;
  title: string | null;
  website: string | null;
  photoFilename: string | null;
  bio: string | null;
  locationSlugs: string[];
  trackSlugs: string[];
  workshopSlugs: string[];
}

export function parseSpeakerDetail(html: string): SpeakerDetail {
  const $ = cheerio.load(html);

  // Name — h1 on the page
  const name = $('h1').first().text().trim();

  // Title/role — p.mb-4 contains the role as a text node before the <strong> website link
  let title: string | null = null;
  const metaP = $('p.mb-4').first();
  if (metaP.length) {
    // Get text nodes only (not the strong/a child content)
    const rawText = metaP.contents()
      .filter(function() { return this.type === 'text'; })
      .map(function() { return $(this).text(); })
      .get()
      .join(' ')
      .trim();
    if (rawText) title = rawText;
  }

  // Website — link inside the p.mb-4 strong; fallback to the sponsor section link
  let website: string | null = null;
  metaP.find('a[href]').each((_, el) => {
    if (website) return;
    const href = $(el).attr('href') || '';
    if (href.startsWith('http')) website = href;
  });

  // Photo — the speaker portrait uses a Craft CMS crop transform
  // Match img with "_crop_center" in src (filters out logo images)
  let photoFilename: string | null = null;
  $('img[src*="_crop_center"]').each((_, el) => {
    if (photoFilename) return;
    const src = $(el).attr('src') || '';
    photoFilename = extractPhotoFilename(src);
  });

  // Location slugs — state SVG icons
  const locationSlugs: string[] = [];
  $('img[src*="/images/states/"]').each((_, el) => {
    const src = $(el).attr('src') || '';
    const abbr = src.match(/\/([A-Z]{2})\.svg/)?.[1];
    if (abbr && STATE_TO_SLUG[abbr] && !locationSlugs.includes(STATE_TO_SLUG[abbr])) {
      locationSlugs.push(STATE_TO_SLUG[abbr]);
    }
  });

  // Track slugs — "Special Tracks" section
  const trackSlugs: string[] = [];
  $('p').each((_, el) => {
    const text = $(el).text().trim();
    if (/special tracks?/i.test(text)) {
      $(el).find('span').each((_, span) => {
        const trackName = $(span).text().trim().toLowerCase();
        const slug = TRACK_NAME_TO_SLUG[trackName];
        if (slug && !trackSlugs.includes(slug)) trackSlugs.push(slug);
      });
      const stripped = text.replace(/special tracks?/i, '').trim().toLowerCase();
      if (stripped) {
        const slug = TRACK_NAME_TO_SLUG[stripped];
        if (slug && !trackSlugs.includes(slug)) trackSlugs.push(slug);
      }
    }
  });

  // Workshop slugs — links to /workshops/{slug} (absolute or relative)
  const workshopSlugs: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.includes('/workshops/')) {
      const slug = workshopSlugFromHref(href);
      if (slug && !workshopSlugs.includes(slug)) workshopSlugs.push(slug);
    }
  });

  // Bio — div.page-content (speaker bios use class="page-content col-sm-12")
  let bio: string | null = null;
  $('div.page-content').each((_, el) => {
    if (bio) return;
    const content = $(el).html()?.trim();
    if (content) bio = content;
  });

  return {
    name,
    title,
    website,
    photoFilename,
    bio,
    locationSlugs,
    trackSlugs,
    workshopSlugs,
  };
}
