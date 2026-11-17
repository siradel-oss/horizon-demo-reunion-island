// Navigation controls, after the Horizon gallery widget (NavigationControls.vue):
//   - compass ring, its red mark pointing north;
//   - four arrows: a click steps the camera, holding moves it continuously;
//   - the knob is a joystick (drag = turn / tilt), a double click (a tap on a
//     touch screen) brings north up;
//   - zoom in / out (click = step, hold = continuous) around the camera altitude.

import { num, t } from "../i18n";
import { h } from "./dom";

export interface NavEvents {
    /** Camera heading (radians) and altitude above the ellipsoid (meters). */
    readState(): Promise<{ bearing: number; altitude: number }>;
    /** One step (click) or a continuous move (hold); x right, y forward, in [-1, 1]. */
    step(x: number, y: number): void;
    beginMove(x: number, y: number): void;
    zoomStep(direction: 1 | -1): void;
    beginZoom(direction: 1 | -1): void;
    /** Joystick: bearing and tilt speeds in [-1, 1]. */
    beginRotate(bearing: number, tilt: number): void;
    /** Ends any continuous move, zoom or rotation. */
    endMove(): void;
    onResetNorth(): void;
    /** Any gesture on the widget (stops the slow orbit, the drone flight…). */
    onInteract(): void;
}

const POLL_MS = 100;
const HOLD_MS = 140; // a press longer than this becomes a continuous move
const KNOB_TRAVEL = 20; // joystick radius, SVG units
const SVG_NS = "http://www.w3.org/2000/svg";

const svg = (tag: string, attrs: Record<string, string | number>) => {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
};

/** Click → `tap`, press held past HOLD_MS → `hold` until release, then `release`. */
function pressable(el: Element, tap: () => void, hold: () => void, release: () => void, before: () => void) {
    el.addEventListener("pointerdown", (e) => {
        const ev = e as PointerEvent;
        if (ev.button !== 0) return;
        ev.preventDefault();
        before();
        let held = false;
        const timer = window.setTimeout(() => {
            held = true;
            hold();
        }, HOLD_MS);
        window.addEventListener(
            "pointerup",
            () => {
                window.clearTimeout(timer);
                if (held) release();
                else tap();
            },
            { once: true },
        );
    });
}

function formatAltitude(m: number): string {
    const rounded = Math.round(m / 10) * 10;
    return rounded > 9999 ? `${Math.round(rounded / 1000)}\nkm` : `${num(rounded)}\nm`;
}

export function createNavControls(ev: NavEvents): HTMLElement {
    const rose = svg("svg", { viewBox: "-100 -100 200 200", class: "nav-rose", role: "group", "aria-label": t({ en: "Compass and moves", fr: "Boussole et déplacements" }) });
    rose.innerHTML = `
        <defs>
            <g id="nav-arrow"><circle r="16" class="nav-arrow-bg" /><path d="M -8 3 L 0 -5 L 8 3" class="nav-arrow-chevron" /></g>
            <radialGradient id="nav-knob" gradientTransform="scale(2) translate(-0.32 -0.32)">
                <stop offset="5%" class="nav-knob-light" /><stop offset="100%" class="nav-knob-dark" />
            </radialGradient>
            <filter id="nav-blur"><feGaussianBlur in="SourceGraphic" stdDeviation="10" /></filter>
        </defs>
        <g filter="url(#nav-blur)" opacity="0.8" class="nav-shadow">
            <circle r="30" /><circle r="40" class="nav-shadow-ring" /><circle r="70" class="nav-shadow-ring" />
        </g>
        <circle r="70" class="nav-ring" />
    `;

    // Arrows: up = forward, right, down = backward, left.
    const arrows: [number, number, number, string][] = [
        [0, 0, 1, t({ en: "Move forward", fr: "Avancer" })],
        [90, 1, 0, t({ en: "Move right", fr: "Aller à droite" })],
        [180, 0, -1, t({ en: "Move back", fr: "Reculer" })],
        [270, -1, 0, t({ en: "Move left", fr: "Aller à gauche" })],
    ];
    for (const [angle, x, y, label] of arrows) {
        const arrow = svg("use", { href: "#nav-arrow", x: 0, y: -70, transform: `rotate(${angle})`, class: "nav-hit" });
        arrow.append(svg("title", {}));
        arrow.firstChild!.textContent = label;
        pressable(arrow, () => ev.step(x, y), () => ev.beginMove(x, y), () => ev.endMove(), ev.onInteract);
        rose.append(arrow);
    }

    rose.append(svg("circle", { r: 40, class: "nav-inner-ring" }));
    const north = svg("path", { d: "M -10 0 L 0 -21 L 10 0 Z", class: "nav-north" });
    rose.append(north);

    // Joystick knob.
    const knob = svg("g", { class: "nav-hit nav-knob" });
    knob.append(svg("circle", { r: 30, class: "nav-knob-rim" }), svg("circle", { r: 25, fill: "url(#nav-knob)" }));
    const knobTitle = svg("title", {});
    knobTitle.textContent = t({ en: "Drag to turn and tilt, double-click to reset north up", fr: "Glisser pour tourner et incliner, double-clic pour remettre le nord en haut" });
    knob.append(knobTitle);
    rose.append(knob);

    knob.addEventListener("dblclick", () => {
        ev.onInteract();
        ev.onResetNorth();
    });
    knob.addEventListener("pointerdown", (e) => {
        const start = e as PointerEvent;
        if (start.button !== 0) return;
        start.preventDefault();
        ev.onInteract();
        // Screen pixels → SVG units (the widget is drawn 120 px for 200 units).
        const scale = 200 / rose.getBoundingClientRect().width;
        let moving = false;
        const move = (e: PointerEvent) => {
            const dx = (e.clientX - start.clientX) * scale;
            const dy = (e.clientY - start.clientY) * scale;
            const r = Math.min(Math.hypot(dx, dy), KNOB_TRAVEL);
            const a = Math.atan2(dy, dx);
            const x = r * Math.cos(a);
            const y = r * Math.sin(a);
            knob.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
            if (r / KNOB_TRAVEL > 0.1) {
                moving = true;
                ev.beginRotate(x / KNOB_TRAVEL, -y / KNOB_TRAVEL);
            } else if (moving) {
                moving = false;
                ev.endMove();
            }
        };
        const up = () => {
            window.removeEventListener("pointermove", move);
            knob.setAttribute("transform", "translate(0 0)");
            if (moving) ev.endMove();
            // Touch: a plain tap brings north up (a double tap is awkward on a phone).
            else if (start.pointerType === "touch") ev.onResetNorth();
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up, { once: true });
    });

    const altitude = h("div", { class: "nav-altitude", "aria-live": "off" });
    const zoomButton = (direction: 1 | -1, glyph: string, label: string) => {
        const b = h("button", { class: "nav-zoom", title: label, "aria-label": label }, glyph);
        pressable(b, () => ev.zoomStep(direction), () => ev.beginZoom(direction), () => ev.endMove(), ev.onInteract);
        return b;
    };

    const element = h(
        "div",
        { class: "nav" },
        rose,
        h("div", { class: "nav-zooms" }, zoomButton(1, "+", t({ en: "Zoom in", fr: "Zoom avant" })), altitude, zoomButton(-1, "−", t({ en: "Zoom out", fr: "Zoom arrière" }))),
    );

    setInterval(async () => {
        if (element.offsetParent === null) return; // hidden: no engine round-trip
        const s = await ev.readState();
        north.setAttribute("transform", `rotate(${((-s.bearing * 180) / Math.PI).toFixed(2)}) translate(0 -36)`);
        const text = formatAltitude(s.altitude);
        if (altitude.textContent !== text) altitude.textContent = text;
    }, POLL_MS);

    return element;
}
