// Hiking trails catalogue (OSM relations, pre-generated) + hiker-facing
// helpers. The map draws the full-resolution geometry from trails.pmtiles; the
// catalogue keeps a resampled copy for profiles, flights and proximity searches.

import { LANG, num, type Text } from "../i18n";

export type Difficulty = "facile" | "moyen" | "difficile" | "expert";

/** [lon, lat, altitude m, cumulative distance m] */
export type TrailPoint = [number, number, number, number];

export interface Trail {
    /** OSM relation id. */
    id: number;
    name: string;
    ref: string | null;
    network: string | null;
    zone: string;
    description: string | null;
    website: string | null;
    from: string | null;
    to: string | null;
    loop: boolean;
    distanceKm: number;
    ascent: number;
    descent: number;
    altMin: number;
    altMax: number;
    hours: number;
    difficulty: Difficulty;
    bbox: [number, number, number, number];
    /** Continuous parts of the route (usually one). */
    lines: TrailPoint[][];
}

export interface TrailsDataset {
    attribution: string;
    zones: { id: string; label: string }[];
    trails: Trail[];
}

/** English names of the sectors (the dataset carries the French ones). */
const ZONES_EN: Record<string, string> = { plaines: "The Plains", nord: "North", ouest: "West", sud: "Wild South", est: "East" };

export async function loadTrails(): Promise<TrailsDataset> {
    const resp = await fetch(`${import.meta.env.BASE_URL}data/trails.json`);
    if (!resp.ok) throw new Error(`trails.json: HTTP ${resp.status}`);
    const data: TrailsDataset = await resp.json();
    if (LANG === "en") for (const z of data.zones) z.label = ZONES_EN[z.id] ?? z.label;
    return data;
}

export const DIFFICULTIES: { id: Difficulty; label: Text; color: string }[] = [
    { id: "facile", label: { en: "Easy", fr: "Facile" }, color: "#5fd39a" },
    { id: "moyen", label: { en: "Moderate", fr: "Moyen" }, color: "#f2c14e" },
    { id: "difficile", label: { en: "Difficult", fr: "Difficile" }, color: "#f0793a" },
    { id: "expert", label: { en: "Strenuous", fr: "Sportif" }, color: "#e0365a" },
];

export const difficultyOf = (d: Difficulty) => DIFFICULTIES.find((x) => x.id === d)!;

/** "2 h 45", or "3 days" for multi-day routes (≈ 6 h of walking a day). */
export function formatDuration(hours: number): string {
    if (hours > 10) return `${Math.ceil(hours / 6)} ${LANG === "fr" ? "jours" : "days"}`;
    const total = Math.round((hours * 60) / 15) * 15;
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h === 0) return `${m} min`;
    return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

export const formatKm = (km: number) => `${num(km, 1)} km`;
export const formatM = (m: number) => `${num(Math.round(m))} m`;

/** All points of a trail, parts concatenated (distances keep increasing). */
export const allPoints = (t: Trail): TrailPoint[] => t.lines.flat();

/** Interpolated point at distance `d` (meters) along the trail. */
export function pointAt(points: TrailPoint[], d: number): TrailPoint {
    if (d <= points[0][3]) return points[0];
    const last = points[points.length - 1];
    if (d >= last[3]) return last;
    let lo = 0;
    let hi = points.length - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (points[mid][3] <= d) lo = mid;
        else hi = mid;
    }
    const a = points[lo];
    const b = points[hi];
    const f = b[3] === a[3] ? 0 : (d - a[3]) / (b[3] - a[3]);
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, d];
}
