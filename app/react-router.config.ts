import type { Config } from "@react-router/dev/config";
import locationsData from "../data/locations.json";
import speakersData from "../data/speakers.json";
import workshopsData from "../data/workshops.json";

const locations = locationsData as Array<{ slug: string }>;
const speakers = speakersData as Array<{ slug: string; locationSlugs: string[] }>;
const workshops = workshopsData as Array<{ slug: string; locationSlugs: string[]; schedule: Record<string, unknown> }>;

export default {
  ssr: false,
  basename: process.env.VITE_BASE_PATH ?? "/",
  async prerender() {
    const routes: string[] = ["/"];

    for (const loc of locations) {
      routes.push(`/${loc.slug}`);
      routes.push(`/${loc.slug}/schedule`);
      routes.push(`/${loc.slug}/compare`);

      for (const w of workshops) {
        if (w.locationSlugs.includes(loc.slug) && w.schedule[loc.slug]) {
          routes.push(`/${loc.slug}/workshops/${w.slug}`);
        }
      }

    }

    for (const s of speakers) {
      routes.push(`/speakers/${s.slug}`);
    }

    return routes;
  },
} satisfies Config;
