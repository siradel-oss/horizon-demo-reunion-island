// Drone flight controls, in the profile dock while a flight runs: play / pause,
// speed, stop. The profile itself moves the drone (see main.ts).

import { t } from "../i18n";
import { h } from "./dom";

export const TOUR_RATES = [0.5, 1, 2];

export interface TourControlEvents {
    onPlay(playing: boolean): void;
    onRate(rate: number): void;
    onStop(): void;
}

export interface TourControls {
    element: HTMLElement;
    /** Reflect the flight state; `null` hides the controls. */
    sync(state: { paused: boolean; rate: number } | null): void;
}

const rateLabel = (r: number) => (r === 0.5 ? "×½" : `×${r}`);

export function createTourControls(ev: TourControlEvents): TourControls {
    let paused = false;
    const play = h("button", {
        class: "tour-btn tour-play",
        onclick: () => ev.onPlay(paused),
    });
    const rates = TOUR_RATES.map((r) =>
        h("button", { class: "tour-btn tour-rate", role: "radio", "aria-checked": "false", title: `${t({ en: "Speed", fr: "Vitesse" })} ${rateLabel(r)}`, onclick: () => ev.onRate(r) }, rateLabel(r)),
    );
    const element = h(
        "div",
        { class: "tour-controls", hidden: true, role: "group", "aria-label": t({ en: "Flyover", fr: "Survol" }) },
        play,
        h("span", { class: "tour-rates", role: "radiogroup", "aria-label": t({ en: "Flyover speed", fr: "Vitesse du survol" }) }, ...rates),
        h("button", { class: "tour-btn", title: t({ en: "Stop the flyover", fr: "Arrêter le survol" }), "aria-label": t({ en: "Stop the flyover", fr: "Arrêter le survol" }), onclick: () => ev.onStop() }, "■"),
    );

    return {
        element,
        sync(state) {
            element.hidden = !state;
            if (!state) return;
            paused = state.paused;
            play.textContent = paused ? "▶" : "❚❚";
            play.title = paused ? t({ en: "Resume the flyover", fr: "Reprendre le survol" }) : t({ en: "Pause", fr: "Mettre en pause" });
            play.setAttribute("aria-label", play.title);
            rates.forEach((b, i) => b.setAttribute("aria-checked", String(TOUR_RATES[i] === state.rate)));
        },
    };
}
