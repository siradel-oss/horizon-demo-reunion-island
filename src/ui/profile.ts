// Elevation profile (SVG). The fill is graded on absolute altitude, from lagoon
// turquoise at sea level to flamboyant red near the summits, so two trails can be
// compared at a glance. Hover reports the distance under the pointer; press and
// drag drive a position along the trail (the drone flight follows it).

import { formatKm, formatM, pointAt, type TrailPoint } from "../data/trails";
import { LOCALE, num, t } from "../i18n";

const SVG = "http://www.w3.org/2000/svg";
const PAD = { left: 44, right: 14, top: 18, bottom: 26 };

// Altitude colour ramp (meters → colour), shared with the sparklines.
export const ALTITUDE_RAMP: [number, string][] = [
    [0, "#2ec4b6"],
    [900, "#7fb069"],
    [1800, "#c9a227"],
    [2600, "#e0663a"],
    [3100, "#d7263d"],
];

/** Colour of the ramp at altitude `z` (linear interpolation between stops). */
function rampColor(z: number): string {
    const i = ALTITUDE_RAMP.findIndex(([s]) => s >= z);
    if (i < 0) return ALTITUDE_RAMP[ALTITUDE_RAMP.length - 1][1];
    if (i === 0) return ALTITUDE_RAMP[0][1];
    const [z0, c0] = ALTITUDE_RAMP[i - 1];
    const [z1, c1] = ALTITUDE_RAMP[i];
    const f = (z - z0) / (z1 - z0);
    const mix = (k: number) => Math.round(parseInt(c0.slice(k, k + 2), 16) * (1 - f) + parseInt(c1.slice(k, k + 2), 16) * f);
    return `rgb(${mix(1)}, ${mix(3)}, ${mix(5)})`;
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
    const node = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    return node;
}

/** Round step for axis ticks (1, 2, 5 × 10^n) giving about `count` ticks. */
function niceStep(span: number, count: number): number {
    const raw = span / count;
    const pow = 10 ** Math.floor(Math.log10(raw));
    return [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
}

let gradientSeq = 0;

export interface Profile {
    /** Move the cursor to distance `d` (meters); null hides it. */
    setCursor(d: number | null): void;
    destroy(): void;
}

export type SeekPhase = "start" | "move" | "end";

export function mountProfile(
    host: HTMLElement,
    points: TrailPoint[],
    onHover: (d: number | null) => void,
    onSeek: (d: number, phase: SeekPhase) => void,
): Profile {
    const svg = el("svg", { class: "profile-svg", role: "img" });
    const tip = document.createElement("div");
    tip.className = "profile-tip";
    host.replaceChildren(svg, tip);

    const length = points[points.length - 1][3];
    const zs = points.map((p) => p[2]);
    const zMin = Math.min(...zs);
    const zMax = Math.max(...zs);
    const span = Math.max(150, zMax - zMin);
    const lo = Math.max(0, zMin - span * 0.12);
    const hi = zMax + span * 0.18;
    svg.setAttribute(
        "aria-label",
        t({
            en: `Elevation profile: ${formatM(zMin)} to ${formatM(zMax)} over ${formatKm(length / 1000)}`,
            fr: `Profil altimétrique : de ${formatM(zMin)} à ${formatM(zMax)} sur ${formatKm(length / 1000)}`,
        }),
    );

    let w = 0;
    let h = 0;
    let cursor: number | null = null;
    const x = (d: number) => PAD.left + (d / length) * (w - PAD.left - PAD.right);
    const y = (z: number) => PAD.top + (1 - (z - lo) / (hi - lo)) * (h - PAD.top - PAD.bottom);
    const gradientId = `alt-ramp-${++gradientSeq}`;
    const cursorGroup = el("g", { class: "profile-cursor" });

    function draw() {
        w = host.clientWidth;
        h = host.clientHeight;
        if (!w || !h) return;
        svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
        svg.replaceChildren();

        // Gradient in user space so a colour always means the same altitude.
        const grad = el("linearGradient", { id: gradientId, gradientUnits: "userSpaceOnUse", x1: 0, x2: 0, y1: y(0), y2: y(3100) });
        for (const [z, c] of ALTITUDE_RAMP) grad.append(el("stop", { offset: z / 3100, "stop-color": c }));
        const defs = el("defs");
        defs.append(grad);
        svg.append(defs);

        // Horizontal grid + altitude labels.
        const zStep = niceStep(hi - lo, 4);
        for (let z = Math.ceil(lo / zStep) * zStep; z <= hi; z += zStep) {
            svg.append(el("line", { class: "grid", x1: PAD.left, x2: w - PAD.right, y1: y(z), y2: y(z) }));
            const label = el("text", { class: "axis", x: PAD.left - 8, y: y(z) + 4, "text-anchor": "end" });
            label.textContent = num(z);
            svg.append(label);
        }
        // Distance labels.
        const kmStep = niceStep(length / 1000, Math.max(3, Math.floor(w / 110)));
        for (let km = 0; km <= length / 1000 + 1e-6; km += kmStep) {
            const label = el("text", { class: "axis", x: x(km * 1000), y: h - 8, "text-anchor": "middle" });
            label.textContent = formatKm(km);
            svg.append(label);
        }

        const line = points.map((p, i) => `${i ? "L" : "M"}${x(p[3]).toFixed(1)},${y(p[2]).toFixed(1)}`).join("");
        const base = y(lo);
        svg.append(
            el("path", { class: "area", d: `${line}L${x(length)},${base}L${x(0)},${base}Z`, fill: `url(#${gradientId})` }),
            el("path", { class: "ridge", d: line }),
        );

        // Summit flag.
        const top = points[zs.indexOf(zMax)];
        // Keep the flag inside the chart when the summit sits at either end.
        const fx = x(top[3]);
        const anchor = fx > w - PAD.right - 40 ? "end" : fx < PAD.left + 40 ? "start" : "middle";
        const flag = el("text", { class: "summit", x: fx, y: y(zMax) - 7, "text-anchor": anchor });
        flag.textContent = `▲ ${formatM(zMax)}`;
        svg.append(flag);

        cursorGroup.replaceChildren(
            el("line", { class: "cursor-rule", y1: PAD.top - 6, y2: h - PAD.bottom }),
            el("circle", { class: "cursor-dot", r: 5.5 }),
        );
        svg.append(cursorGroup);
        placeCursor();
    }

    function placeCursor() {
        if (cursor == null || !w) {
            cursorGroup.style.display = "none";
            tip.style.opacity = "0";
            return;
        }
        const p = pointAt(points, cursor);
        const cx = x(p[3]);
        const cy = y(p[2]);
        cursorGroup.style.display = "";
        const [rule, dot] = cursorGroup.children;
        rule.setAttribute("x1", String(cx));
        rule.setAttribute("x2", String(cx));
        dot.setAttribute("cx", String(cx));
        dot.setAttribute("cy", String(cy));
        tip.textContent = `${(p[3] / 1000).toLocaleString(LOCALE, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} km  ${formatM(p[2])}`;
        tip.style.opacity = "1";
        tip.style.transform = `translate(${Math.min(Math.max(cx, 60), w - 60)}px, 0) translateX(-50%)`;
    }

    const toDistance = (ev: PointerEvent) => {
        const r = svg.getBoundingClientRect();
        const f = (ev.clientX - r.left - PAD.left) / (r.width - PAD.left - PAD.right);
        return Math.min(1, Math.max(0, f)) * length;
    };
    let seeking = false;
    svg.addEventListener("pointerdown", (ev) => {
        if (ev.button !== 0) return;
        seeking = true;
        svg.setPointerCapture(ev.pointerId);
        cursor = toDistance(ev);
        placeCursor();
        onSeek(cursor, "start");
    });
    svg.addEventListener("pointermove", (ev) => {
        cursor = toDistance(ev);
        placeCursor();
        if (seeking) onSeek(cursor, "move");
        else onHover(cursor);
    });
    const endSeek = (ev: PointerEvent) => {
        if (!seeking) return;
        seeking = false;
        onSeek(toDistance(ev), "end");
    };
    svg.addEventListener("pointerup", endSeek);
    svg.addEventListener("pointercancel", endSeek);
    svg.addEventListener("pointerleave", () => {
        cursor = null;
        placeCursor();
        onHover(null);
    });

    const observer = new ResizeObserver(draw);
    observer.observe(host);
    draw();

    return {
        setCursor(d) {
            cursor = d;
            placeCursor();
        },
        destroy() {
            observer.disconnect();
            host.replaceChildren();
        },
    };
}

/** Tiny profile for list rows (stroke only, coloured by altitude). */
export function sparkline(points: TrailPoint[], width = 92, height = 30): SVGSVGElement {
    const svg = el("svg", { class: "spark", viewBox: `0 0 ${width} ${height}`, width, height, "aria-hidden": "true" });
    const length = points[points.length - 1][3];
    const zs = points.map((p) => p[2]);
    const lo = Math.min(...zs);
    const hi = Math.max(lo + 120, Math.max(...zs));
    const step = Math.max(1, Math.floor(points.length / 60));
    const sampled = points.filter((_, i) => i % step === 0).concat([points[points.length - 1]]);
    const path = sampled
        .map((p, i) => `${i ? "L" : "M"}${((p[3] / length) * (width - 2) + 1).toFixed(1)},${(height - 2 - ((p[2] - lo) / (hi - lo)) * (height - 4)).toFixed(1)}`)
        .join("");
    const id = `spark-${++gradientSeq}`;
    const grad = el("linearGradient", { id, gradientUnits: "userSpaceOnUse", x1: 0, x2: 0, y1: height - 2, y2: 2 });
    // The row's own altitude range, cut out of the global ramp.
    const stops: [number, string][] = [
        [lo, rampColor(lo)],
        ...ALTITUDE_RAMP.filter(([z]) => z > lo && z < hi),
        [hi, rampColor(hi)],
    ];
    for (const [z, c] of stops) grad.append(el("stop", { offset: (z - lo) / (hi - lo), "stop-color": c }));
    const defs = el("defs");
    defs.append(grad);
    svg.append(defs, el("path", { d: path, fill: "none", stroke: `url(#${id})`, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
    return svg;
}
