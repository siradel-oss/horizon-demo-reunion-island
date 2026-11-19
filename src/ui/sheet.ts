// Phone layout: the side panel becomes a bottom sheet with four snap points.
//   closed  the handle only: the map takes the screen, to just look around
//   mini  just the header of the current sheet (a trail: the profile shows above)
//   half  the list or the sheet, the map still visible above
//   full  almost the whole screen
// The handle cycles with a tap, or follows a vertical drag and snaps to the
// nearest point. The state is also exposed as body[data-sheet] for the CSS.
// On a desktop width the panel keeps its CSS size.

import { t } from "../i18n";

export type SheetState = "closed" | "mini" | "half" | "full";

export interface Sheet {
    set(state: SheetState): void;
    readonly state: SheetState;
    /** Height (px) the sheet is heading to; 0 on a desktop width. */
    readonly height: number;
}

const ORDER: SheetState[] = ["closed", "mini", "half", "full"];
/** Height of the handle, all that a closed sheet keeps. */
const HANDLE_PX = 24;
const TAP_PX = 6;
/** Phone layout (same breakpoint as the CSS). */
export const PHONE_LAYOUT = matchMedia("(max-width: 760px)");

/** Sheet height (px) of a snap point; `mini` is the CSS --sheet-mini. */
function snapHeight(state: SheetState): number {
    if (state === "closed") return HANDLE_PX;
    if (state === "mini") return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sheet-mini")) || 76;
    // Above the sheet: the search bar (and the tab bar under it).
    return state === "half" ? Math.round(innerHeight * 0.44) : innerHeight - 150;
}

export function createSheet(panel: HTMLElement, handle: HTMLElement): Sheet {
    let state: SheetState = "half";

    const apply = () => {
        if (PHONE_LAYOUT.matches) panel.style.height = `${snapHeight(state)}px`;
        else panel.style.removeProperty("height");
    };
    const set = (next: SheetState) => {
        state = next;
        document.body.dataset.sheet = next;
        handle.setAttribute("aria-label", next === "full" ? t({ en: "Collapse the panel", fr: "Réduire le panneau" }) : t({ en: "Expand the panel", fr: "Agrandir le panneau" }));
        apply();
    };

    handle.addEventListener("pointerdown", (e) => {
        const startY = e.clientY;
        const startH = panel.getBoundingClientRect().height;
        handle.setPointerCapture(e.pointerId);
        panel.classList.add("dragging"); // no height transition while following the finger
        let moved = false;

        const move = (ev: PointerEvent) => {
            const dy = startY - ev.clientY;
            if (Math.abs(dy) > TAP_PX) moved = true;
            if (moved) panel.style.height = `${Math.max(48, startH + dy)}px`;
        };
        const up = (ev: PointerEvent) => {
            handle.removeEventListener("pointermove", move);
            panel.classList.remove("dragging");
            if (!moved) {
                // Tap: a closed sheet opens halfway, full folds back to half, otherwise one step up.
                set(state === "closed" || state === "full" ? "half" : ORDER[ORDER.indexOf(state) + 1]);
                return;
            }
            const target = startH + (startY - ev.clientY);
            set(ORDER.reduce((best, s) => (Math.abs(snapHeight(s) - target) < Math.abs(snapHeight(best) - target) ? s : best)));
        };
        handle.addEventListener("pointermove", move);
        handle.addEventListener("pointerup", up, { once: true });
    });

    addEventListener("resize", apply);
    PHONE_LAYOUT.addEventListener("change", apply);
    set(state);
    return {
        set,
        get state() {
            return state;
        },
        get height() {
            return PHONE_LAYOUT.matches ? snapHeight(state) : 0;
        },
    };
}
