// Place search in the top bar: IGN autocompletion as you type (combobox, keyboard
// friendly), plus a "my position" button (browser geolocation).

import { searchPlaces, type Place } from "../data/geocode";
import { t } from "../i18n";
import { h } from "./dom";

export interface SearchEvents {
    onPick(place: Place): void;
    onLocate(): void;
    /** The field was emptied: drop the marker. */
    onClear(): void;
}

export interface SearchBox {
    element: HTMLElement;
    /** Status line under the field (errors, "locating…"); empty hides it. */
    setStatus(text: string): void;
}

const DEBOUNCE_MS = 250;
const MIN_CHARS = 3;

export function createSearchBox(ev: SearchEvents): SearchBox {
    let results: Place[] = [];
    let active = -1;
    let timer = 0;
    let pending: AbortController | null = null;

    const list = h("ul", { class: "search-results", id: "search-results", role: "listbox", hidden: true });
    const status = h("p", { class: "search-status", role: "status", hidden: true });
    const input = h("input", {
        type: "search",
        class: "search-input",
        placeholder: t({ en: "A place, an address…", fr: "Un lieu, une adresse…" }),
        "aria-label": t({ en: "Search for a place or an address in La Réunion (IGN)", fr: "Rechercher un lieu ou une adresse à La Réunion (IGN)" }),
        role: "combobox",
        "aria-autocomplete": "list",
        "aria-expanded": "false",
        "aria-controls": "search-results",
        autocomplete: "off",
    });

    function open(next: Place[]) {
        results = next;
        active = -1;
        list.replaceChildren(
            ...results.map((p, i) =>
                h(
                    "li",
                    {
                        id: `search-option-${i}`,
                        role: "option",
                        class: "search-option",
                        "aria-selected": "false",
                        // pointerdown, not click: fires before the input loses focus.
                        onpointerdown: (e: Event) => {
                            e.preventDefault();
                            pick(i);
                        },
                    },
                    h("span", { class: "search-name" }, p.name),
                    h("span", { class: "search-detail" }, p.detail),
                ),
            ),
        );
        list.hidden = !results.length;
        input.setAttribute("aria-expanded", String(!list.hidden));
    }

    const close = () => open([]);

    function highlight(i: number) {
        active = (i + results.length) % results.length;
        list.querySelectorAll("li").forEach((li, k) => li.setAttribute("aria-selected", String(k === active)));
        input.setAttribute("aria-activedescendant", `search-option-${active}`);
    }

    function pick(i: number) {
        const p = results[i];
        if (!p) return;
        input.value = p.name;
        close();
        input.blur();
        ev.onPick(p);
    }

    function setStatus(text: string) {
        status.textContent = text;
        status.hidden = !text;
    }

    input.addEventListener("input", () => {
        window.clearTimeout(timer);
        pending?.abort();
        const text = input.value.trim();
        if (!text) ev.onClear();
        if (text.length < MIN_CHARS) {
            close();
            return;
        }
        timer = window.setTimeout(async () => {
            pending = new AbortController();
            try {
                const found = await searchPlaces(text, pending.signal);
                setStatus(found.length ? "" : t({ en: "No place found in La Réunion.", fr: "Aucun lieu trouvé à La Réunion." }));
                open(found);
            } catch (e) {
                if ((e as Error).name !== "AbortError") setStatus(t({ en: "The IGN search is not responding, try again.", fr: "La recherche IGN ne répond pas, réessayez." }));
            }
        }, DEBOUNCE_MS);
    });

    input.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" && results.length) highlight(active + 1);
        else if (e.key === "ArrowUp" && results.length) highlight(active - 1);
        else if (e.key === "Enter") pick(active >= 0 ? active : 0);
        else if (e.key === "Escape") {
            close();
            setStatus("");
        } else return;
        e.preventDefault();
        e.stopPropagation(); // Escape here must not leave full screen or stop a flight
    });
    input.addEventListener("blur", () => window.setTimeout(close, 100));

    const locate = h(
        "button",
        { class: "search-locate", title: t({ en: "My location", fr: "Ma position" }), "aria-label": t({ en: "Locate me", fr: "Me localiser" }), onclick: () => ev.onLocate() },
        h("span", { class: "locate-icon", "aria-hidden": "true" }),
    );

    const element = h("div", { class: "search-box", role: "search" }, h("div", { class: "search-field" }, input, locate), list, status);
    return { element, setStatus };
}
