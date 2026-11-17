// Ambiance popover: light presets, time of day, haze and lens focal length.

import { AMBIANCES, focalToFovy, type Ambiance } from "../engine/scene";
import { t } from "../i18n";
import { h } from "./dom";

export const FOCALS = [16, 24, 35, 50, 85];

export interface AmbianceEvents {
    onAmbiance(a: Ambiance): void;
    onHour(hour: number): void;
    onFocal(mm: number): void;
}

export const formatHour = (hour: number) => `${Math.floor(hour)} h ${String(Math.round((hour % 1) * 60)).padStart(2, "0")}`;

export function createAmbiancePanel(initial: { ambiance: Ambiance; focal: number }, ev: AmbianceEvents): HTMLElement {
    let current = { ...initial.ambiance };

    const hourOut = h("output", {}, formatHour(current.hour));
    const hour = h("input", {
        type: "range",
        // Daylight in July, local solar time (sunrise ≈ 6 h 35, sunset ≈ 17 h 25).
        min: 6.75,
        max: 17.25,
        step: 0.05,
        value: current.hour,
        "aria-label": t({ en: "Solar time", fr: "Heure solaire" }),
        oninput: (e: Event) => {
            current.hour = Number((e.target as HTMLInputElement).value);
            hourOut.textContent = formatHour(current.hour);
            ev.onHour(current.hour);
        },
    });

    const haze = h("input", {
        type: "range",
        min: 0,
        max: 1,
        step: 0.01,
        value: current.haze,
        "aria-label": t({ en: "Haze", fr: "Brume" }),
        // Haze changes the whole fog block: apply on release, not on every step.
        onchange: (e: Event) => {
            current.haze = Number((e.target as HTMLInputElement).value);
            ev.onAmbiance(current);
        },
    });

    const presets = h(
        "div",
        { class: "presets", role: "radiogroup", "aria-label": t({ en: "Moods", fr: "Ambiances" }) },
        ...AMBIANCES.map((a) =>
            h(
                "button",
                {
                    class: `preset preset-${a.id}`,
                    role: "radio",
                    "aria-checked": String(a.id === current.id),
                    onclick: (e: Event) => {
                        current = { ...a };
                        presets.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(b === e.currentTarget)));
                        hour.value = String(a.hour);
                        hourOut.textContent = formatHour(a.hour);
                        haze.value = String(a.haze);
                        ev.onAmbiance(current);
                    },
                },
                h("span", { class: "preset-name" }, t(a.label)),
                h("span", { class: "preset-hint" }, t(a.hint)),
            ),
        ),
    );

    const fovOut = h("output", {}, `${Math.round(focalToFovy(initial.focal))}°`);
    const focals = h(
        "div",
        { class: "lens", role: "radiogroup", "aria-label": t({ en: "Focal length", fr: "Focale" }) },
        ...FOCALS.map((mm) =>
            h(
                "button",
                {
                    role: "radio",
                    "aria-checked": String(mm === initial.focal),
                    onclick: (e: Event) => {
                        focals.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(b === e.currentTarget)));
                        fovOut.textContent = `${Math.round(focalToFovy(mm))}°`;
                        ev.onFocal(mm);
                    },
                },
                `${mm}`,
            ),
        ),
    );

    return h(
        "div",
        { class: "ambiance-body" },
        presets,
        h("label", { class: "control" }, h("span", {}, t({ en: "Solar time", fr: "Heure solaire" })), hourOut, hour),
        h("label", { class: "control" }, h("span", {}, t({ en: "Haze", fr: "Brume" })), h("output", {}, ""), haze),
        h("div", { class: "control" }, h("span", {}, t({ en: "Focal length (mm, full frame)", fr: "Focale (mm, plein format)" })), fovOut, focals),
    );
}
