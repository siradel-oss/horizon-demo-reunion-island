// "To see" tab: places by category, and the place sheet (text, nearby hikes).

import { CATEGORIES, categoryOf, nearbyTrails, type Poi, type PoiCategory, type PoisDataset } from "../data/pois";
import { formatDuration, formatM, type Trail } from "../data/trails";
import { LANG, LOCALE, t, type Text } from "../i18n";
import { h } from "./dom";
import { sheetNav } from "./sheet-nav";

export interface PoiPanelEvents {
    onSelect(index: number): void;
    onBack(): void;
    onRefocus(index: number): void;
    onFilter(active: Set<PoiCategory>): void;
    onOpenTrail(index: number): void;
}

export interface PoiPanel {
    element: HTMLElement;
    showList(): void;
    showPoi(index: number): void;
}

/** Practical line when the place has no description of its own. */
const TIPS: Record<PoiCategory, Text> = {
    cascade: {
        en: "When it rains, ravines swell within minutes: do not swim there and do not cross fords.",
        fr: "Par temps de pluie, les ravines gonflent en quelques minutes : on ne s'y baigne pas et on ne traverse pas les radiers.",
    },
    vue: {
        en: "The view is clearest in the morning, before the clouds climb up the cliffs.",
        fr: "La vue est la plus dégagée le matin, avant que les nuages ne montent à l'assaut des remparts.",
    },
    sommet: {
        en: "Summits are mostly clear at dawn: set off early to see them without clouds.",
        fr: "Les sommets se découvrent surtout à l'aube : partez tôt pour les voir sans nuages.",
    },
    lave: {
        en: "Recent lava flows are fragile and sharp: stay on marked paths.",
        fr: "Les coulées récentes sont fragiles et coupantes : restez sur les sentiers balisés.",
    },
    plage: {
        en: "Swim only in supervised areas: outside the lagoons, the shark risk in La Réunion is real.",
        fr: "Baignade uniquement dans les zones surveillées : hors lagon, le risque requin est réel à La Réunion.",
    },
    patrimoine: {
        en: "A heritage site of La Réunion, shaped by Creole, Indian, Chinese and European roots.",
        fr: "Un lieu du patrimoine réunionnais, entre héritages créole, indien, chinois et européen.",
    },
};
const fallbackText = (p: Poi) => t(TIPS[p.cat]);

export function createPoiPanel(data: PoisDataset, trails: Trail[], zoneLabel: (id: string) => string, ev: PoiPanelEvents): PoiPanel {
    const { pois } = data;
    const active = new Set<PoiCategory>(CATEGORIES.map((c) => c.id));
    let query = "";
    const element = h("div", { class: "poi" });

    // Documented places first: they make the best first impression.
    const order = pois
        .map((p, i) => ({ p, i, score: p.text ? 1 : 0 }))
        .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name, LOCALE));

    const count = h("p", { class: "count", "aria-live": "polite" });
    const list = h("ol", { class: "poi-list" });
    /** Places shown by the list, in its order: previous / next follow it. */
    let shown = order.map(({ i }) => i);

    const chips = h(
        "div",
        { class: "chips", role: "group", "aria-label": t({ en: "Categories", fr: "Catégories" }) },
        ...CATEGORIES.map((c) =>
            h(
                "button",
                {
                    class: "chip",
                    "aria-pressed": "true",
                    style: { "--chip": c.color },
                    onclick: (e: Event) => {
                        if (active.has(c.id)) active.delete(c.id);
                        else active.add(c.id);
                        (e.currentTarget as HTMLElement).setAttribute("aria-pressed", String(active.has(c.id)));
                        ev.onFilter(new Set(active));
                        renderRows();
                    },
                },
                h("span", { class: "dot" }),
                t(c.label),
            ),
        ),
    );

    const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    const altitudeOf = (p: Poi) => (p.cat === "sommet" && p.ele ? p.ele : p.alt);

    const thumb = (p: Poi) => h("span", { class: "poi-thumb thumb-empty", style: { "--chip": categoryOf(p.cat).color }, "aria-hidden": "true" });

    function renderRows() {
        const q = normalize(query.trim());
        const rows = order.filter(({ p }) => active.has(p.cat) && (!q || normalize(`${p.name} ${zoneLabel(p.zone)}`).includes(q)));
        shown = rows.map(({ i }) => i);
        count.textContent = t(rows.length > 1 ? { en: `${rows.length} places`, fr: `${rows.length} lieux` } : { en: `${rows.length} place`, fr: `${rows.length} lieu` });
        list.replaceChildren(
            ...rows.map(({ p, i }) =>
                h(
                    "li",
                    {},
                    h(
                        "button",
                        { class: "poi-row", onclick: () => ev.onSelect(i) },
                        thumb(p),
                        h(
                            "span",
                            { class: "row-main" },
                            h("span", { class: "row-name" }, p.name),
                            h("span", { class: "row-zone" }, `${t(categoryOf(p.cat).one)}, ${zoneLabel(p.zone)}`),
                        ),
                    ),
                ),
            ),
        );
        if (!rows.length) list.replaceChildren(h("li", { class: "empty" }, t({ en: "No place matches this search.", fr: "Aucun lieu ne correspond à cette recherche." })));
    }

    const listView = h(
        "div",
        { class: "list-view" },
        h("h2", { class: "panel-title" }, t({ en: "To see", fr: "À voir" })),
        h(
            "p",
            { class: "lede" },
            t({
                en: "Waterfalls, lookouts, lava flows, temples and beaches: pick a place and the camera takes you there.",
                fr: "Cascades, belvédères, coulées de lave, temples et plages : choisissez un lieu, la caméra vous y emmène.",
            }),
        ),
        h("input", {
            type: "search",
            class: "search",
            placeholder: t({ en: "A place: Voile de la Mariée, Maïdo…", fr: "Un lieu : Voile de la Mariée, Maïdo…" }),
            "aria-label": t({ en: "Search for a place", fr: "Rechercher un lieu" }),
            oninput: (e: Event) => {
                query = (e.target as HTMLInputElement).value;
                renderRows();
            },
        }),
        chips,
        count,
        list,
    );

    function sheet(i: number): HTMLElement {
        const p = pois[i];
        const c = categoryOf(p.cat);
        const near = nearbyTrails(p, trails).slice(0, 4);
        return h(
            "article",
            { class: "poi-sheet", style: { "--chip": c.color } },
            sheetNav({ backLabel: t({ en: "All places", fr: "Tous les lieux" }), onBack: ev.onBack, order: shown, current: i, nameOf: (k) => pois[k].name, onGo: ev.onSelect }),
            h("p", { class: "sheet-zone" }, h("span", { class: "dot" }), t(c.one)),
            h("h2", { class: "sheet-title" }, p.name),
            h("p", { class: "sheet-route" }, `${zoneLabel(p.zone)}, ${t({ en: "altitude", fr: "altitude" })} ${formatM(altitudeOf(p))}`),
            h("p", { class: "sheet-text" }, p.text ?? fallbackText(p)),
            p.text ? h("p", { class: "sheet-text tip" }, fallbackText(p)) : null,
            h("div", { class: "actions" }, h("button", { class: "btn", onclick: () => ev.onRefocus(i) }, t({ en: "Recenter the view", fr: "Recentrer la vue" }))),
            near.length
                ? h(
                      "section",
                      { class: "nearby" },
                      h("h3", {}, t({ en: "Get there on foot", fr: "Y aller à pied" })),
                      h(
                          "ul",
                          {},
                          ...near.map(({ index, meters }) =>
                              h(
                                  "li",
                                  {},
                                  h(
                                      "button",
                                      { class: "nearby-row", onclick: () => ev.onOpenTrail(index) },
                                      h("span", { class: "row-name" }, trails[index].name),
                                      h(
                                          "span",
                                          { class: "row-zone" },
                                          meters < 150
                                              ? t({ en: `passes by, ${formatDuration(trails[index].hours)} walk`, fr: `passe sur place, ${formatDuration(trails[index].hours)} de marche` })
                                              : t({
                                                    en: `passes ${formatM(Math.round(meters / 50) * 50)} away, ${formatDuration(trails[index].hours)} walk`,
                                                    fr: `passe à ${formatM(Math.round(meters / 50) * 50)}, ${formatDuration(trails[index].hours)} de marche`,
                                                }),
                                      ),
                                  ),
                              ),
                          ),
                      ),
                  )
                : null,
            p.source
                ? h(
                      "p",
                      { class: "fine" },
                      t({ en: "Text: excerpt from ", fr: "Texte : extrait de " }),
                      h("a", { href: p.source.url, target: "_blank", rel: "noopener" }, p.source.label),
                      ", ",
                      h("a", { href: "https://creativecommons.org/licenses/by-sa/4.0/", target: "_blank", rel: "noopener" }, "CC BY-SA 4.0"),
                      LANG === "en" && p.source.url.includes("//fr.") ? " (in French)" : "",
                  )
                : null,
        );
    }

    renderRows();
    element.append(listView);

    return {
        element,
        showList() {
            element.replaceChildren(listView);
        },
        showPoi(i) {
            element.replaceChildren(sheet(i));
            element.parentElement?.scrollTo(0, 0); // the panel body is the scroller
        },
    };
}
