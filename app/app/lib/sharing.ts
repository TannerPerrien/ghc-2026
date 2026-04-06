import type { SharedSchedule } from "./types";

export function encodeSchedule(data: SharedSchedule): string {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodeSchedule(encoded: string): SharedSchedule {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as SharedSchedule;
}

export function buildShareUrl(
  locationSlug: string,
  encoded: string,
  base = window.location.origin
): string {
  return `${base}/${locationSlug}?schedule=${encoded}`;
}
