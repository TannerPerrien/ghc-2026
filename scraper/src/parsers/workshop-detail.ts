import * as cheerio from 'cheerio';

const STATE_TO_SLUG: Record<string, string> = {
  SC: 'south-carolina',
  MO: 'missouri',
  OH: 'ohio',
  CA: 'california',
  TX: 'texas',
};

export interface WorkshopDetail {
  description: string | null;
  locationSlugs: string[];
}

export function parseWorkshopDetail(html: string): WorkshopDetail {
  const $ = cheerio.load(html);

  // Location slugs from state SVG icons
  const locationSlugs: string[] = [];
  $('img[src*="/images/states/"]').each((_, el) => {
    const src = $(el).attr('src') || '';
    const abbr = src.match(/\/([A-Z]{2})\.svg/)?.[1];
    if (abbr && STATE_TO_SLUG[abbr] && !locationSlugs.includes(STATE_TO_SLUG[abbr])) {
      locationSlugs.push(STATE_TO_SLUG[abbr]);
    }
  });

  // Description — div with class "page-content col-sm-12"
  let description: string | null = null;
  $('div.page-content').each((_, el) => {
    if (description) return;
    const content = $(el).html()?.trim();
    if (content) description = content;
  });

  return { description, locationSlugs };
}
