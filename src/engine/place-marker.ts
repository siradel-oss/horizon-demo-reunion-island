// Marker of the searched place or of the visitor's position: a lagoon dot
// with a white ring, inside a soft halo.

import type { Api } from "./horizon";
import { color, createOverlay, dot, feature, point } from "./overlays";

export interface PlaceMarker {
    /** Show the marker at a position; null hides it. `kind` 1 = "you are here". */
    set(position: { lon: number; lat: number; kind: 0 | 1 } | null): void;
}

export async function addPlaceMarker(api: Api): Promise<PlaceMarker> {
    const overlay = await createOverlay(
        api,
        "Place marker",
        { features: [] },
        // Searched place: lagoon; own position: sun yellow.
        `fork { emit 0; } if (attr("kind") == 1) { emit 2; } else { emit 1; }`,
        [
            dot(0, 20, 12, { defaultValue: color("#ffffff", 0.22) }, "#ffffff", 1.5, 0.7),
            dot(1, 9, 13, { defaultValue: color("#2ec4b6") }, "#ffffff", 3.5),
            dot(2, 9, 13, { defaultValue: color("#ffd166") }, "#10201c", 3.5),
        ],
    );
    return {
        set(position) {
            overlay.setFeatures(position ? [feature(point(position.lon, position.lat), 0, position.kind)] : []);
        },
    };
}
