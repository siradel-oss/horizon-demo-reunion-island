// Hiking overlays:
//   - every trail (trails.pmtiles, coloured by difficulty), restyled when one
//     is selected;
//   - trailheads (one dot per trail), pickable from the island overview;
//   - a cursor: start / finish of the selected trail and the moving hiker.

import { HrzProtocol } from "@siradel-oss/horizon-protocol";
import { DIFFICULTIES, type Trail, type TrailPoint } from "../data/trails";
import type { Api } from "./horizon";
import { color, colorByKind, createOverlay, dot, feature, line, point, px, type Feature, type ObjectRef } from "./overlays";

export interface TrailLayers {
    /** Highlight one trail (dataset index) and dim the others; -1 restores all. */
    select(index: number): void;
    /** Place the hiker marker (null hides it). */
    setHiker(p: TrailPoint | null): void;
    setVisible(visible: boolean): void;
    /** Trail index of a hovered / picked feature, or -1. */
    trailIndexOf(ref: ObjectRef): number;
}

const DIFFICULTY_COLOR = colorByKind(DIFFICULTIES.map((d) => d.color));
const byDifficulty = { name: "c", defaultValue: color("#ffffff") };
const startOf = (t: Trail) => point(t.lines[0][0][0], t.lines[0][0][1]);

export async function addTrailLayers(api: Api, trails: Trail[], attribution: string): Promise<TrailLayers> {
    const kindOf = (t: Trail) => DIFFICULTIES.findIndex((d) => d.id === t.difficulty);

    const linesScript = (selected: number) => `
        ${DIFFICULTY_COLOR}
        if (attr("fid") == ${selected}) { fork { emit 2; } fork { emit 3; } emit 4; }
        elif (${selected} >= 0) { emit 5; }
        else { fork { emit 0; } emit 1; }
    `;
    const lines = await createOverlay(
        api,
        "Trails",
        { pmtiles: "trails.pmtiles", attribution },
        linesScript(-1),
        [
            line(0, 5, 1, { defaultValue: color("#10201c", 0.55) }),
            line(1, 2.6, 2, byDifficulty),
            // Selected trail: soft halo, dark casing, then a bright core with marching dashes.
            line(2, 16, 5, { defaultValue: color("#ffffff", 0.18) }),
            line(3, 8, 6, { defaultValue: color("#10201c", 0.8) }),
            line(4, 4.5, 7, { defaultValue: color("#ffd166") }, {
                dashes: {
                    mode: HrzProtocol.DashMode.DASH_ENABLED_FILLED,
                    period: { defaultValue: px(28) },
                    periodUnit: HrzProtocol.DashSizeUnit.DASH_SIZE_IN_PIXELS,
                    primarySegmentLength: { defaultValue: px(18) },
                    primarySegmentLengthUnit: HrzProtocol.DashSizeUnit.DASH_SIZE_IN_PIXELS,
                    secondaryColor: { defaultValue: color("#fff8e1") },
                    animationSpeed: { defaultValue: px(24) },
                    animationSpeedUnit: HrzProtocol.DashSizeUnit.DASH_SIZE_IN_PIXELS,
                },
            }),
            line(5, 2, 1, { defaultValue: color("#f5efe0", 0.35) }),
        ],
    );

    const headsScript = (selected: number) => `
        ${DIFFICULTY_COLOR}
        if (${selected} >= 0) { discard; }
        emit 0;
    `;
    const heads = await createOverlay(
        api,
        "Trailheads",
        { features: trails.map((t, i) => feature(startOf(t), i, kindOf(t))) },
        headsScript(-1),
        [dot(0, 6, 8, byDifficulty, "#10201c", 2)],
    );

    // Cursor kinds: 0 = start, 1 = finish, 2 = hiker.
    const cursor = await createOverlay(
        api,
        "Trail cursor",
        { features: [] },
        `if (attr("kind") == 2) { emit 2; } elif (attr("kind") == 1) { emit 1; } else { emit 0; }`,
        [
            dot(0, 8, 10, { defaultValue: color("#5fd39a") }, "#ffffff", 3),
            dot(1, 8, 10, { defaultValue: color("#e0365a") }, "#ffffff", 3),
            dot(2, 9, 11, { defaultValue: color("#ffffff") }, "#10201c", 4),
        ],
    );

    let selected = -1;
    let hiker: TrailPoint | null = null;

    const refreshCursor = () => {
        const features: Feature[] = [];
        if (selected >= 0) {
            const t = trails[selected];
            const end = t.lines[t.lines.length - 1].at(-1)!;
            features.push(feature(startOf(t), selected, 0));
            if (!t.loop) features.push(feature(point(end[0], end[1]), selected, 1));
        }
        if (hiker) features.push(feature(point(hiker[0], hiker[1]), selected, 2));
        cursor.setFeatures(features);
    };

    return {
        select(index) {
            selected = index;
            lines.setScript(linesScript(index));
            heads.setScript(headsScript(index));
            refreshCursor();
        },
        setHiker(p) {
            hiker = p;
            refreshCursor();
        },
        setVisible(visible) {
            for (const overlay of [lines, heads, cursor]) overlay.setVisible(visible);
        },
        trailIndexOf: (ref) => Math.max(lines.indexOf(ref), heads.indexOf(ref)),
    };
}
