// "À voir" overlay (pois.pmtiles): one dot per place, coloured by category; categories can be
// filtered out, and the selected place gets a larger dot inside a soft ring.

import { CATEGORIES, type PoiCategory } from "../data/pois";
import type { Api } from "./horizon";
import { color, colorByKind, createOverlay, dot, type ObjectRef } from "./overlays";

export interface PoiLayers {
    select(index: number): void;
    /** Show only these categories. */
    filter(active: Set<PoiCategory>): void;
    setVisible(visible: boolean): void;
    poiIndexOf(ref: ObjectRef): number;
}

export async function addPoiLayers(api: Api, attribution: string): Promise<PoiLayers> {
    let selected = -1;
    let active = new Set(CATEGORIES.map((c) => c.id));

    const script = () => {
        // One test per hidden category: no reliance on boolean operators in the DSL.
        const hidden = CATEGORIES.map((c, i) => (active.has(c.id) ? "" : `if (attr("kind") == ${i}) { discard; }`)).join(" ");
        return `
            ${colorByKind(CATEGORIES.map((c) => c.color))}
            if (attr("fid") == ${selected}) { fork { emit 1; } emit 2; }
            ${hidden}
            emit 0;
        `;
    };
    const fill = { name: "c", defaultValue: color("#ffffff") };
    const overlay = await createOverlay(
        api,
        "Points of interest",
        { pmtiles: "pois.pmtiles", attribution },
        script(),
        [
            dot(0, 4.5, 3, fill, "#10201c", 1.5, 0.8),
            dot(1, 17, 4, { defaultValue: color("#ffffff", 0.16) }, "#ffffff", 2, 0.9),
            dot(2, 8, 5, fill, "#ffffff", 3),
        ],
    );

    return {
        select(index) {
            selected = index;
            overlay.setScript(script());
        },
        filter(next) {
            active = next;
            overlay.setScript(script());
        },
        setVisible: overlay.setVisible,
        poiIndexOf: overlay.indexOf,
    };
}
