// "Hike" tab: searchable / filterable trail list, and the trail sheet.

import {
    DIFFICULTIES,
    allPoints,
    difficultyOf,
    formatDuration,
    formatKm,
    formatM,
    type Difficulty,
    type Trail,
    type TrailsDataset,
} from "../data/trails";
import { categoryOf, poisAlong, type Poi } from "../data/pois";
import { LOCALE, num, t } from "../i18n";
import { h } from "./dom";
import { sparkline } from "./profile";
import { sheetNav } from "./sheet-nav";

type SortKey = "name" | "distance" | "ascent" | "duration";

const FLY_LABEL = t({ en: "Fly over the route", fr: "Survoler le parcours" });

/** Trail status is not in OSM: send hikers to the official source. */
const ONF_STATUS_URL = "https://www.onf.fr/vivre-la-foret/+/b90::randonnee-la-reunion-connaitre-les-sentiers-fermes.html";

export interface HikePanelEvents {
    onSelect(index: number): void;
    onBack(): void;
    onFly(index: number): void;
    onFrame(index: number): void;
    onHoverRow(index: number | null): void;
    onOpenPoi(index: number): void;
    onTrees(visible: boolean): void;
}

export interface HikePanel {
    element: HTMLElement;
    showList(): void;
    showTrail(index: number): void;
    setTouring(touring: boolean): void;
}

export function createHikePanel(data: TrailsDataset, pois: Poi[], ev: HikePanelEvents): HikePanel {
    let treesOn = false;
    const { trails, zones } = data;
    const zoneLabel = (id: string) => zones.find((z) => z.id === id)?.label ?? "";
    const state = { query: "", difficulties: new Set<Difficulty>(), zone: "", sort: "name" as SortKey };
    const sparks = trails.map((trail) => sparkline(allPoints(trail)));
    let flyButton: HTMLButtonElement | null = null;
    /** Trails shown by the list, in its order: previous / next follow it. */
    let shown = trails.map((_, i) => i);

    const element = h("div", { class: "hike" });

    // --- List ----------------------------------------------------------------

    const count = h("p", { class: "count", "aria-live": "polite" });
    const list = h("ol", { class: "trail-list" });

    const search = h("input", {
        type: "search",
        class: "search",
        placeholder: t({ en: "A name, a place: Dolomieu, Mafate…", fr: "Un nom, un lieu : Dolomieu, Mafate…" }),
        "aria-label": t({ en: "Search for a hike", fr: "Rechercher une randonnée" }),
        oninput: (e: Event) => {
            state.query = (e.target as HTMLInputElement).value;
            renderRows();
        },
    });

    const chips = h(
        "div",
        { class: "chips", role: "group", "aria-label": t({ en: "Level", fr: "Niveau" }) },
        ...DIFFICULTIES.map((d) =>
            h(
                "button",
                {
                    class: "chip",
                    "aria-pressed": "false",
                    style: { "--chip": d.color },
                    onclick: (e: Event) => {
                        const btn = e.currentTarget as HTMLButtonElement;
                        if (state.difficulties.has(d.id)) state.difficulties.delete(d.id);
                        else state.difficulties.add(d.id);
                        btn.setAttribute("aria-pressed", String(state.difficulties.has(d.id)));
                        renderRows();
                    },
                },
                h("span", { class: "dot" }),
                t(d.label),
            ),
        ),
    );

    const zoneSelect = h(
        "select",
        {
            "aria-label": t({ en: "Sector", fr: "Secteur" }),
            onchange: (e: Event) => {
                state.zone = (e.target as HTMLSelectElement).value;
                renderRows();
            },
        },
        h("option", { value: "" }, t({ en: "Whole island", fr: "Toute l'île" })),
        ...zones.filter((z) => trails.some((trail) => trail.zone === z.id)).map((z) => h("option", { value: z.id }, z.label)),
    );

    const sortSelect = h(
        "select",
        {
            "aria-label": t({ en: "Sort", fr: "Trier" }),
            onchange: (e: Event) => {
                state.sort = (e.target as HTMLSelectElement).value as SortKey;
                renderRows();
            },
        },
        h("option", { value: "name" }, t({ en: "By name", fr: "Par nom" })),
        h("option", { value: "duration" }, t({ en: "Shortest first", fr: "Les plus courtes" })),
        h("option", { value: "distance" }, t({ en: "Longest first", fr: "Les plus longues" })),
        h("option", { value: "ascent" }, t({ en: "Most climbing", fr: "Le plus de dénivelé" })),
    );

    const listView = h(
        "div",
        { class: "list-view" },
        h("h2", { class: "panel-title" }, t({ en: "Hikes", fr: "Randonnées" })),
        h(
            "p",
            { class: "lede" },
            t({
                en: "Pick a trail: it is drawn on the relief, with its profile and walking time.",
                fr: "Choisissez un sentier : il se dessine sur le relief, avec son profil et son temps de marche.",
            }),
        ),
        h(
            "p",
            { class: "fine warning" },
            t({
                en: "Demonstration only: trails, times and levels come from open data and calculations, and may be wrong or out of date. Do not use them to plan a hike.",
                fr: "Démonstration seulement : sentiers, durées et niveaux viennent de données ouvertes et de calculs, et peuvent être faux ou périmés. Ne pas s'en servir pour préparer une sortie.",
            }),
        ),
        search,
        chips,
        h("div", { class: "selects" }, zoneSelect, sortSelect),
        count,
        list,
    );

    const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

    function renderRows() {
        const q = normalize(state.query.trim());
        const rows = trails
            .map((trail, i) => ({ trail, i }))
            .filter(({ trail }) => !state.difficulties.size || state.difficulties.has(trail.difficulty))
            .filter(({ trail }) => !state.zone || trail.zone === state.zone)
            .filter(({ trail }) => !q || normalize(`${trail.name} ${trail.ref ?? ""} ${zoneLabel(trail.zone)} ${trail.from ?? ""} ${trail.to ?? ""}`).includes(q));
        const by: Record<SortKey, (a: Trail, b: Trail) => number> = {
            name: (a, b) => a.name.localeCompare(b.name, LOCALE),
            distance: (a, b) => b.distanceKm - a.distanceKm,
            ascent: (a, b) => b.ascent - a.ascent,
            duration: (a, b) => a.hours - b.hours,
        };
        rows.sort((a, b) => by[state.sort](a.trail, b.trail));
        shown = rows.map(({ i }) => i);

        count.textContent = rows.length ? t(rows.length > 1 ? { en: `${rows.length} hikes`, fr: `${rows.length} randonnées` } : { en: "1 hike", fr: "1 randonnée" }) : "";
        list.replaceChildren(
            ...rows.map(({ trail, i }) =>
                h(
                    "li",
                    {},
                    h(
                        "button",
                        {
                            class: "trail-row",
                            style: { "--diff": difficultyOf(trail.difficulty).color },
                            onclick: () => ev.onSelect(i),
                            onmouseenter: () => ev.onHoverRow(i),
                            onmouseleave: () => ev.onHoverRow(null),
                            onfocus: () => ev.onHoverRow(i),
                            onblur: () => ev.onHoverRow(null),
                        },
                        h(
                            "span",
                            { class: "row-main" },
                            h("span", { class: "row-name" }, trail.name),
                            h("span", { class: "row-zone" }, zoneLabel(trail.zone)),
                        ),
                        sparks[i],
                        h(
                            "span",
                            { class: "row-figures" },
                            h("span", {}, formatKm(trail.distanceKm)),
                            h("span", {}, `${formatDuration(trail.hours)}`),
                            h("span", {}, `D+ ${formatM(trail.ascent)}`),
                        ),
                    ),
                ),
            ),
        );
        if (!rows.length) {
            list.replaceChildren(
                h(
                    "li",
                    { class: "empty" },
                    t({ en: "No trail matches. ", fr: "Aucun sentier ne correspond. " }),
                    h("button", { class: "link", onclick: resetFilters }, t({ en: "Clear filters", fr: "Effacer les filtres" })),
                ),
            );
        }
    }

    function resetFilters() {
        state.query = "";
        state.zone = "";
        state.difficulties.clear();
        search.value = "";
        zoneSelect.value = "";
        chips.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false"));
        renderRows();
    }

    // --- Trail sheet ---------------------------------------------------------

    function sheet(i: number): HTMLElement {
        const trail = trails[i];
        const diff = difficultyOf(trail.difficulty);
        flyButton = h("button", { class: "btn primary", onclick: () => ev.onFly(i) }, FLY_LABEL);
        const route = trail.from && trail.to ? `${trail.from} → ${trail.to}` : trail.loop ? t({ en: "Loop, back to the start", fr: "Boucle, retour au point de départ" }) : t({ en: "One way", fr: "Aller simple" });
        return h(
            "article",
            { class: "trail-sheet", style: { "--diff": diff.color } },
            sheetNav({ backLabel: t({ en: "All hikes", fr: "Toutes les randonnées" }), onBack: ev.onBack, order: shown, current: i, nameOf: (k) => trails[k].name, onGo: ev.onSelect }),
            h("p", { class: "sheet-zone" }, zoneLabel(trail.zone), trail.ref && trail.ref !== trail.name ? `, ${trail.ref}` : ""),
            h("h2", { class: "sheet-title" }, trail.name),
            h("p", { class: "sheet-route" }, route),
            h(
                "dl",
                { class: "figures" },
                fig(t({ en: "Distance", fr: "Distance" }), formatKm(trail.distanceKm)),
                fig(t({ en: "Estimated time", fr: "Durée estimée" }), formatDuration(trail.hours)),
                fig(t({ en: "Ascent", fr: "Dénivelé positif" }), formatM(trail.ascent)),
                fig(t({ en: "Descent", fr: "Dénivelé négatif" }), formatM(trail.descent)),
                fig(t({ en: "High point", fr: "Point haut" }), formatM(trail.altMax)),
                fig(t({ en: "Low point", fr: "Point bas" }), formatM(trail.altMin)),
            ),
            h("p", { class: "level" }, h("span", { class: "dot" }), t({ en: `${diff.label.en} level`, fr: `Niveau ${diff.label.fr.toLowerCase()}` })),
            trail.description ? h("p", { class: "sheet-text" }, trail.description) : null,
            along(trail),
            h("div", { class: "actions" }, flyButton, h("button", { class: "btn", onclick: () => ev.onFrame(i) }, t({ en: "Recenter", fr: "Recentrer" }))),
            h(
                "button",
                {
                    class: "btn trees-toggle",
                    "aria-pressed": String(treesOn),
                    title: t({
                        en: "Real trees from the IGN LiDAR HD survey, within 150 m on either side of the trails. They appear as you get closer to the ground.",
                        fr: "Arbres réels du LiDAR HD de l'IGN, sur 150 m de part et d'autre des sentiers. Ils apparaissent en se rapprochant du relief.",
                    }),
                    onclick: (e: Event) => {
                        treesOn = !treesOn;
                        (e.currentTarget as HTMLElement).setAttribute("aria-pressed", String(treesOn));
                        ev.onTrees(treesOn);
                    },
                },
                t({ en: "3D trees along the trail", fr: "Arbres 3D le long du sentier" }),
            ),
            h(
                "p",
                { class: "fine" },
                t({
                    en: "Indicative time for an average walker, without breaks (DIN 33466 method). Always check the trail status and the weather before setting off. ",
                    fr: "Durée indicative pour un marcheur moyen, hors pauses (méthode DIN 33466). Vérifiez toujours l'état du sentier et la météo avant de partir. ",
                }),
                h("a", { href: ONF_STATUS_URL, target: "_blank", rel: "noopener" }, t({ en: "Closed trails: check with the ONF", fr: "Sentiers fermés : vérifier auprès de l'ONF" })),
                " / ",
                trail.website ? h("a", { href: trail.website, target: "_blank", rel: "noopener" }, t({ en: "Website", fr: "Site web" })) : null,
                trail.website ? " / " : null,
                h("a", { href: `https://www.openstreetmap.org/relation/${trail.id}`, target: "_blank", rel: "noopener" }, t({ en: "OpenStreetMap route", fr: "Tracé OpenStreetMap" })),
            ),
        );
    }

    /** "Along the way": places the trail passes by, with their kilometre point. */
    function along(trail: Trail): HTMLElement | null {
        const stops = poisAlong(trail, pois).slice(0, 8);
        if (!stops.length) return null;
        return h(
            "section",
            { class: "nearby" },
            h("h3", {}, t({ en: "Along the way", fr: "En chemin" })),
            h(
                "ul",
                {},
                ...stops.map(({ index, at }) =>
                    h(
                        "li",
                        {},
                        h(
                            "button",
                            { class: "nearby-row", style: { "--chip": categoryOf(pois[index].cat).color }, onclick: () => ev.onOpenPoi(index) },
                            h("span", { class: "row-name" }, h("span", { class: "dot" }), pois[index].name),
                            h("span", { class: "row-zone" }, `${t(categoryOf(pois[index].cat).one)}, km ${num(at / 1000, 1)}`),
                        ),
                    ),
                ),
            ),
        );
    }

    const fig = (label: string, value: string) => h("div", { class: "figure" }, h("dt", {}, label), h("dd", {}, value));

    renderRows();
    element.append(listView);

    return {
        element,
        showList() {
            flyButton = null;
            element.replaceChildren(listView);
        },
        showTrail(i) {
            element.replaceChildren(sheet(i));
            element.parentElement?.scrollTo(0, 0); // the panel body is the scroller
        },
        setTouring(touring) {
            if (flyButton) flyButton.textContent = touring ? t({ en: "Stop the flyover", fr: "Arrêter le survol" }) : FLY_LABEL;
        },
    };
}
