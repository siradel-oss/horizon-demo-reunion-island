// Sun profile: a band under the elevation profile, coloured by what lights each
// stretch of the trail at the current solar hour, and a one-line summary.

import { LIGHTS, type Light } from "../data/sun";
import { t } from "../i18n";
import { h } from "./dom";

const SVG = "http://www.w3.org/2000/svg";

export interface SunStrip {
    element: HTMLElement;
    /** Redraw for the lights of each sample (same order as `d`). */
    update(lights: Light[], hourLabel: string): void;
}

/** `d`: sample distances along the trail (m); `length`: trail length (m). */
export function createSunStrip(d: number[], length: number): SunStrip {
    const band = document.createElementNS(SVG, "svg");
    band.setAttribute("class", "sun-band");
    band.setAttribute("viewBox", "0 0 1000 10");
    band.setAttribute("preserveAspectRatio", "none");
    band.setAttribute("aria-hidden", "true");
    const summary = h("p", { class: "sun-summary", "aria-live": "polite" });
    const element = h("div", { class: "sun-strip" }, band, summary);

    // Each sample lights the stretch up to the next one.
    const ends = d.map((_, i) => (i + 1 < d.length ? d[i + 1] : length));

    return {
        element,
        update(lights, hourLabel) {
            const share = new Map<Light, number>();
            band.replaceChildren(
                ...lights.map((light, i) => {
                    const from = (d[i] / length) * 1000;
                    const to = (ends[i] / length) * 1000;
                    share.set(light, (share.get(light) ?? 0) + ends[i] - d[i]);
                    const r = document.createElementNS(SVG, "rect");
                    r.setAttribute("x", from.toFixed(2));
                    r.setAttribute("width", Math.max(0.5, to - from).toFixed(2));
                    r.setAttribute("height", "10");
                    r.setAttribute("class", `light-${light}`);
                    return r;
                }),
            );
            const total = [...share.values()].reduce((a, b) => a + b, 0) || 1;
            summary.replaceChildren(
                h("strong", {}, `${t({ en: "At", fr: "À" })} ${hourLabel}`),
                ...LIGHTS.filter((l) => share.get(l.id)).map((l) =>
                    h("span", { class: `sun-key light-${l.id}` }, `${Math.round((100 * share.get(l.id)!) / total)} % ${t(l.label)}`),
                ),
            );
        },
    };
}
