// Sun and shade along a trail at a given solar hour, pre-generated (trail-sun.json):
// canopy above the trail (LiDAR HD) and relief horizon in 16 directions.

import type { Text } from "../i18n";

export interface TrailSun {
    /** Distance of each sample along the trail, meters (same scale as TrailPoint[3]). */
    d: number[];
    /** One digit per sample: canopy cover 0 (open sky) – 9 (closed canopy). */
    canopy: string;
    /** `directions` characters per sample: relief horizon in whole degrees (base64 digits). */
    horizon: string;
}

export interface SunDataset {
    directions: number;
    trails: TrailSun[];
}

export async function loadSun(): Promise<SunDataset> {
    const resp = await fetch(`${import.meta.env.BASE_URL}data/trail-sun.json`);
    if (!resp.ok) throw new Error(`trail-sun.json: HTTP ${resp.status}`);
    return resp.json();
}

/** What lights each stretch: open sun, dappled light, tree shade, relief shadow. */
export type Light = "sun" | "dappled" | "trees" | "relief";

export const LIGHTS: { id: Light; label: Text }[] = [
    { id: "sun", label: { en: "in the sun", fr: "au soleil" } },
    { id: "dappled", label: { en: "in dappled shade", fr: "à la mi-ombre" } },
    { id: "trees", label: { en: "under the trees", fr: "sous les arbres" } },
    { id: "relief", label: { en: "in the shade of the relief", fr: "à l'ombre du relief" } },
];

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Sun elevation and azimuth (degrees; azimuth clockwise from north) at a local
 * solar time — the same convention as the engine's SUN_DIRECTION_RELATIVE_TO_DATE.
 */
export function sunPosition(latDeg: number, dayOfYear: number, hour: number): { elevation: number; azimuth: number } {
    const decl = rad(23.44) * Math.sin((2 * Math.PI * (284 + dayOfYear)) / 365);
    const ha = rad(15 * (hour - 12));
    const lat = rad(latDeg);
    const sinEl = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
    const el = Math.asin(sinEl);
    // Azimuth from north, clockwise (east = 90°).
    const az = Math.atan2(-Math.sin(ha) * Math.cos(decl), Math.cos(lat) * Math.sin(decl) - Math.sin(lat) * Math.cos(decl) * Math.cos(ha));
    return { elevation: (el * 180) / Math.PI, azimuth: ((az * 180) / Math.PI + 360) % 360 };
}

/** Light of every sample of a trail. */
export function lightAlong(sun: TrailSun, directions: number, latDeg: number, dayOfYear: number, hour: number): Light[] {
    const { elevation, azimuth } = sunPosition(latDeg, dayOfYear, hour);
    const sector = (azimuth / 360) * directions;
    const k0 = Math.floor(sector) % directions;
    const k1 = (k0 + 1) % directions;
    const f = sector - Math.floor(sector);
    return sun.d.map((_, i) => {
        const h = sun.horizon.slice(i * directions, (i + 1) * directions);
        const horizon = B64.indexOf(h[k0]) * (1 - f) + B64.indexOf(h[k1]) * f;
        if (elevation <= horizon) return "relief";
        const canopy = Number(sun.canopy[i]);
        return canopy >= 6 ? "trees" : canopy >= 3 ? "dappled" : "sun";
    });
}
