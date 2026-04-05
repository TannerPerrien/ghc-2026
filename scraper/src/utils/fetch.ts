import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const BASE_URL = 'https://greathomeschoolconventions.com';
const CACHE_DIR = path.join(__dirname, '../../.cache');

let useCache = true;

export function setFresh(fresh: boolean) {
  useCache = !fresh;
}

function cacheKey(url: string): string {
  // Turn URL into a safe filename
  const hash = crypto.createHash('md5').update(url).digest('hex').slice(0, 8);
  const safe = url.replace(/^https?:\/\/[^/]+/, '').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(0, 80);
  return `${safe}-${hash}`;
}

async function fetchWithRetry(url: string, retries = 3): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GHC-scraper/1.0)' },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return await res.text();
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = attempt * 1000;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('unreachable');
}

export async function fetchText(urlPath: string): Promise<string> {
  const url = urlPath.startsWith('http') ? urlPath : `${BASE_URL}${urlPath}`;
  const key = cacheKey(url);
  const cachePath = path.join(CACHE_DIR, key);

  if (useCache && fs.existsSync(cachePath)) {
    process.stdout.write(`[cache] ${urlPath}\n`);
    return fs.readFileSync(cachePath, 'utf-8');
  }

  process.stdout.write(`[fetch] ${urlPath}\n`);
  const body = await fetchWithRetry(url);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cachePath, body, 'utf-8');
  return body;
}

export async function fetchJson<T = unknown>(urlPath: string): Promise<T> {
  const text = await fetchText(urlPath);
  return JSON.parse(text) as T;
}
