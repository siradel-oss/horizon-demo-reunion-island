// Top bar of a sheet (hike or place): back to the list, and previous / next in
// the order the list currently shows (search, filters and sort applied).

import { t } from "../i18n";
import { h } from "./dom";

export interface SheetNavOptions {
    backLabel: string;
    onBack(): void;
    /** Dataset indices, in list order. */
    order: number[];
    current: number;
    nameOf(index: number): string;
    onGo(index: number): void;
}

export function sheetNav(o: SheetNavOptions): HTMLElement {
    // A sheet opened from elsewhere (3D click, "nearby" link) may be filtered out of the list.
    const order = o.order.includes(o.current) ? o.order : [o.current];
    const at = order.indexOf(o.current);

    const step = (delta: number, label: string, glyph: string) => {
        const target = order[at + delta];
        return h(
            "button",
            {
                class: "step",
                disabled: target == null,
                title: target == null ? label : `${label}${t({ en: ":", fr: " :" })} ${o.nameOf(target)}`,
                "aria-label": target == null ? label : `${label}${t({ en: ":", fr: " :" })} ${o.nameOf(target)}`,
                onclick: () => target != null && o.onGo(target),
            },
            glyph,
        );
    };

    return h(
        "nav",
        { class: "sheet-nav", "aria-label": "Navigation entre les fiches" },
        h("button", { class: "back", onclick: () => o.onBack() }, `‹ ${o.backLabel}`),
        h(
            "span",
            { class: "steps" },
            step(-1, t({ en: "Previous", fr: "Précédent" }), "‹"),
            h("span", { class: "step-pos" }, `${at + 1} / ${order.length}`),
            step(1, t({ en: "Next", fr: "Suivant" }), "›"),
        ),
    );
}
