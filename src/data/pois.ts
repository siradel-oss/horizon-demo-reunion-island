// Points of interest ("To see"), pre-generated from OpenStreetMap and Wikipedia.

import type { Text } from "../i18n";
import type { Trail } from "./trails";

export type PoiCategory = "sommet" | "cascade" | "vue" | "plage" | "lave" | "patrimoine";

export interface Poi {
    id: string;
    name: string;
    cat: PoiCategory;
    zone: string;
    lon: number;
    lat: number;
    /** Ground altitude (RGE ALTI®), meters. */
    alt: number;
    /** Summit elevation as mapped, when known. */
    ele: number | null;
    /** Wikipedia summary (French, or English when no French article exists). */
    text: string | null;
    source: { label: string; url: string } | null;
}

export interface PoisDataset {
    attribution: string;
    pois: Poi[];
}

export async function loadPois(): Promise<PoisDataset> {
    const resp = await fetch(`${import.meta.env.BASE_URL}data/pois.json`);
    if (!resp.ok) throw new Error(`pois.json: HTTP ${resp.status}`);
    return resp.json();
}

/** Display order, label, colour, and how far the camera stands back (m). */
export const CATEGORIES: { id: PoiCategory; label: Text; one: Text; color: string; distance: number }[] = [
    { id: "cascade", label: { en: "Waterfalls and pools", fr: "Cascades et bassins" }, one: { en: "Waterfall", fr: "Cascade" }, color: "#4cc9f0", distance: 1800 },
    { id: "vue", label: { en: "Viewpoints", fr: "Points de vue" }, one: { en: "Viewpoint", fr: "Point de vue" }, color: "#c77dff", distance: 2600 },
    { id: "sommet", label: { en: "Summits", fr: "Sommets" }, one: { en: "Summit", fr: "Sommet" }, color: "#f1f3e4", distance: 4200 },
    { id: "lave", label: { en: "Volcano and lava flows", fr: "Volcan et coulées" }, one: { en: "Volcanic site", fr: "Site volcanique" }, color: "#ff5a36", distance: 2400 },
    { id: "plage", label: { en: "Beaches and lagoons", fr: "Plages et lagons" }, one: { en: "Beach", fr: "Plage" }, color: "#f6bd60", distance: 2400 },
    { id: "patrimoine", label: { en: "Heritage and culture", fr: "Patrimoine et culture" }, one: { en: "Heritage", fr: "Patrimoine" }, color: "#ff8fab", distance: 1100 },
];

export const categoryOf = (id: PoiCategory) => CATEGORIES.find((c) => c.id === id)!;

/** Trails passing within `maxM` meters of a place, nearest first. */
export function nearbyTrails(poi: Poi, trails: Trail[], maxM = 1500): { index: number; meters: number }[] {
    const mPerLon = 111_320 * Math.cos((poi.lat * Math.PI) / 180);
    const out: { index: number; meters: number }[] = [];
    trails.forEach((t, index) => {
        let best = Infinity;
        for (const part of t.lines)
            for (const p of part) best = Math.min(best, Math.hypot((p[0] - poi.lon) * mPerLon, (p[1] - poi.lat) * 111_320));
        if (best <= maxM) out.push({ index, meters: best });
    });
    return out.sort((a, b) => a.meters - b.meters);
}

/** Places within `maxM` meters of a trail, in walking order. */
export function poisAlong(trail: Trail, pois: Poi[], maxM = 350): { index: number; at: number }[] {
    const [w, s, e, n] = trail.bbox;
    const pad = 0.01;
    const out: { index: number; at: number }[] = [];
    pois.forEach((poi, index) => {
        if (poi.lon < w - pad || poi.lon > e + pad || poi.lat < s - pad || poi.lat > n + pad) return;
        const mPerLon = 111_320 * Math.cos((poi.lat * Math.PI) / 180);
        let best = Infinity;
        let at = 0;
        for (const part of trail.lines)
            for (const p of part) {
                const d = Math.hypot((p[0] - poi.lon) * mPerLon, (p[1] - poi.lat) * 111_320);
                if (d < best) [best, at] = [d, p[3]];
            }
        if (best <= maxM) out.push({ index, at });
    });
    return out.sort((a, b) => a.at - b.at);
}
