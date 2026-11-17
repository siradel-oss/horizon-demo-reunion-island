// "Explore" tab: the landscape only. Curated shots and a slow orbit.

import { PLACES, type Place } from "../data/places";
import { t } from "../i18n";
import { h } from "./dom";

export interface ExploreEvents {
    onPlace(place: Place): void;
    onOverview(): void;
    onSpin(on: boolean): void;
}

export interface ExplorePanel {
    element: HTMLElement;
    /** Reflect a spin stopped from elsewhere (user gesture, tab change). */
    setSpinning(on: boolean): void;
}

export function createExplorePanel(ev: ExploreEvents): ExplorePanel {
    let spinning = false;
    const spin = h(
        "button",
        {
            class: "btn",
            "aria-pressed": "false",
            onclick: () => {
                spinning = !spinning;
                spin.setAttribute("aria-pressed", String(spinning));
                ev.onSpin(spinning);
            },
        },
        t({ en: "Slow orbit", fr: "Rotation lente" }),
    );

    const places = PLACES.map((p) =>
        h(
            "li",
            {},
            h(
                "button",
                {
                    class: "place",
                    "aria-pressed": "false",
                    onclick: (e: Event) => {
                        element.querySelectorAll(".place").forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget)));
                        ev.onPlace(p);
                    },
                },
                h("span", { class: "place-name" }, p.name),
                h("span", { class: "place-kind" }, t(p.kind)),
                h("span", { class: "place-text" }, t(p.text)),
            ),
        ),
    );

    const element = h(
        "div",
        { class: "explore" },
        h("h2", { class: "panel-title" }, t({ en: "The island in relief", fr: "L'île en relief" })),
        h(
            "p",
            { class: "lede" },
            t({
                en: "IGN aerial imagery, 1 m relief and buildings, from the lagoon to the summit. Drag to turn, scroll to dive in.",
                fr: "Orthophotos, relief au mètre et bâtiments de l'IGN, du lagon au sommet. Faites glisser pour tourner, molette pour plonger.",
            }),
        ),
        h(
            "div",
            { class: "actions compact" },
            h("button", { class: "btn", onclick: () => ev.onOverview() }, t({ en: "Overview", fr: "Vue d'ensemble" })),
            spin,
        ),
        h("ul", { class: "places" }, ...places),
    );

    return {
        element,
        setSpinning(on) {
            spinning = on;
            spin.setAttribute("aria-pressed", String(on));
        },
    };
}
