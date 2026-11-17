// Place search on the IGN Géoplateforme (autocompletion, La Réunion only) and
// ground altitude (IGN altimetry), both called from the browser (CORS open).

const COMPLETION_URL = "https://data.geopf.fr/geocodage/completion/";
const ALTIMETRY_URL = "https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json";

export interface Place {
    /** Main line ("Hell Bourg"). */
    name: string;
    /** Second line ("Lieu-dit, 97433 Salazie"). */
    detail: string;
    lon: number;
    lat: number;
    /** How far the camera stands back to frame it (m). */
    distance: number;
}

interface CompletionResult {
    x: number;
    y: number;
    fulltext: string;
    kind?: string;
    country?: string; // "PositionOfInterest" | "StreetAddress" (sic)
    poiType?: string[];
}

import { LANG, t } from "../i18n";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Labels of the address kinds (IGN POI kinds come in French). */
const ADDRESS_KINDS: Record<string, string> =
    LANG === "fr"
        ? { municipality: "commune", locality: "lieu-dit", street: "voie", housenumber: "adresse" }
        : { municipality: "municipality", locality: "locality", street: "street", housenumber: "address" };

/** Frame a town wide, a hamlet or a summit closer, an address at street level. */
function distanceFor(r: CompletionResult): number {
    if (r.poiType?.includes("commune")) return 7000;
    if (r.kind === "municipality") return 5000;
    if (r.kind === "street" || r.kind === "housenumber") return 900;
    return 2500;
}

export async function searchPlaces(text: string, signal?: AbortSignal): Promise<Place[]> {
    const params = new URLSearchParams({
        text,
        terr: "974", // La Réunion only
        type: "PositionOfInterest,StreetAddress",
        maximumResponses: "7",
    });
    const resp = await fetch(`${COMPLETION_URL}?${params}`, { signal });
    if (!resp.ok) throw new Error(`${t({ en: "IGN geocoding", fr: "Géocodage IGN" })}: HTTP ${resp.status}`);
    const { results = [] } = (await resp.json()) as { results?: CompletionResult[] };
    // The same place often comes twice (a town as a POI and as an address):
    // keep the first of each name + kind.
    const seen = new Set<string>();
    return results
        .map((r) => {
            const [name, ...rest] = r.fulltext.split(", ");
            const kind = r.poiType?.includes("commune") ? ADDRESS_KINDS.municipality : (r.poiType?.[0] ?? ADDRESS_KINDS[r.kind ?? ""] ?? r.kind ?? "");
            const where = rest.join(", ");
            return { key: `${name}|${kind}`, name, detail: [kind && capitalize(kind), where].filter(Boolean).join(", "), lon: r.x, lat: r.y, distance: distanceFor(r) };
        })
        .filter(({ key }) => !seen.has(key) && seen.add(key))
        .map(({ key: _, ...place }) => place);
}

/** Ground altitude (RGE ALTI®), meters; 0 if the service fails. */
export async function groundAltitude(lon: number, lat: number): Promise<number> {
    try {
        const params = new URLSearchParams({ lon: String(lon), lat: String(lat), resource: "ign_rge_alti_wld", zonly: "true" });
        const resp = await fetch(`${ALTIMETRY_URL}?${params}`);
        const z = (await resp.json()).elevations?.[0];
        return typeof z === "number" && z > -1000 ? z : 0;
    } catch {
        return 0;
    }
}
