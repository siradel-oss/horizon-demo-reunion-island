// "About" dialog: what the app is (a Horizon demonstrator), its limits, privacy,
// data sources and licences, links and contact. Opened from the top bar and
// from the credit line; `openAbout("sources")` scrolls to the data sources.

import { LANG, setLang, t, type Text } from "../i18n";
import { LINKS } from "../links";
import { h } from "./dom";
import { SIRADEL_LOGO } from "./siradel-logo";

const licenceUrl = (file: string) => `${import.meta.env.BASE_URL}licenses/${file}`;

const a = (href: string, text: string) => h("a", { href, target: "_blank", rel: "noopener" }, text);

/** A paragraph mixing text and links: string parts are { en, fr } pairs. */
const p = (...parts: (Text | Node)[]) => h("p", {}, ...parts.map((x) => (x instanceof Node ? x : t(x))));

interface Source {
    producer: string;
    datasets: Text;
    licence: [string, string];
}

const SOURCES: Source[] = [
    {
        producer: "IGN, Géoplateforme",
        datasets: {
            en: "BD ORTHO® aerial imagery, RGE ALTI® elevation, BD TOPO® buildings and vegetation, LiDAR HD canopy height, geocoding and altimetry services",
            fr: "Orthophotos BD ORTHO®, altimétrie RGE ALTI®, bâti et végétation BD TOPO®, hauteur de canopée LiDAR HD, services de géocodage et d'altimétrie",
        },
        licence: ["Licence Ouverte 2.0", "https://www.etalab.gouv.fr/licence-ouverte-open-licence/"],
    },
    {
        producer: "OpenStreetMap",
        datasets: {
            en: "Hiking routes and points of interest, © OpenStreetMap contributors",
            fr: "Itinéraires de randonnée et points d'intérêt, © contributeurs OpenStreetMap",
        },
        licence: ["ODbL 1.0", "https://www.openstreetmap.org/copyright"],
    },
    {
        producer: "Wikipedia",
        datasets: { en: "Excerpts of articles describing places (mostly in French)", fr: "Extraits d'articles décrivant les lieux" },
        licence: ["CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"],
    },
    {
        producer: "Siradel",
        datasets: { en: "3D tree models, Horizon engine", fr: "Modèles 3D d'arbres, moteur Horizon" },
        licence: ["MIT", `${LINKS.repo}/blob/main/LICENSE`],
    },
];

const DERIVED: Text[] = [
    {
        en: "trail distance, ascent, high and low points: OpenStreetMap routes resampled and draped on RGE ALTI®;",
        fr: "distance, dénivelés, points haut et bas des sentiers : tracés OpenStreetMap rééchantillonnés et posés sur le RGE ALTI® ;",
    },
    {
        en: "walking time (DIN 33466) and level: computed from these figures, not from an official grading;",
        fr: "durée de marche (DIN 33466) et niveau : calculés à partir de ces chiffres, pas d'une cotation officielle ;",
    },
    {
        en: "3D trees: tree tops detected in the LiDAR HD canopy height model, typed with BD TOPO® vegetation;",
        fr: "arbres 3D : sommets de couronne détectés dans le modèle de hauteur de canopée LiDAR HD, typés par la végétation BD TOPO® ;",
    },
    {
        en: "sun and shade strip: canopy cover and relief horizon along the trails, for an approximate sun position.",
        fr: "bande soleil / ombre : couvert des arbres et horizon du relief le long des sentiers, pour une position du soleil approchée.",
    },
];

export function createAbout(): { open(section?: "sources"): void } {
    const close = h("button", { class: "about-close", "aria-label": t({ en: "Close", fr: "Fermer" }), onclick: () => dialog.close() }, "✕");
    const langSwitch = h(
        "div",
        { class: "lang-switch", role: "group", "aria-label": t({ en: "Language", fr: "Langue" }) },
        ...(["en", "fr"] as const).map((l) => h("button", { "aria-pressed": String(l === LANG), lang: l, onclick: () => setLang(l) }, l === "en" ? "English" : "Français")),
    );

    const sources = h(
        "section",
        { id: "about-sources" },
        h("h3", {}, t({ en: "Data sources and licences", fr: "Sources des données et licences" })),
        h(
            "ul",
            { class: "about-sources" },
            ...SOURCES.map((s) => h("li", {}, h("strong", {}, s.producer), h("span", {}, t(s.datasets)), a(s.licence[1], s.licence[0]))),
        ),
        p({
            en: "The hiking routes and points of interest bundled with this app (public/data) are a derivative of OpenStreetMap and are distributed under the ODbL.",
            fr: "Les itinéraires et points d'intérêt livrés avec l'application (public/data) dérivent d'OpenStreetMap et sont diffusés sous ODbL.",
        }),
        h("h4", {}, t({ en: "Computed by this application", fr: "Calculé par l'application" })),
        p({
            en: "These layers are neither published nor validated by the data producers:",
            fr: "Ces informations ne sont ni publiées ni validées par les producteurs des données :",
        }),
        h("ul", {}, ...DERIVED.map((d) => h("li", {}, t(d)))),
        // The licence files ship with the build (public/licenses), as the SIL OFL requires.
        p(
            { en: "Fonts: Bricolage Grotesque (", fr: "Polices : Bricolage Grotesque (" },
            a(licenceUrl("BricolageGrotesque-OFL.txt"), "SIL OFL 1.1"),
            { en: ") and Figtree (", fr: ") et Figtree (" },
            a(licenceUrl("Figtree-OFL.txt"), "SIL OFL 1.1"),
            { en: ").", fr: ")." },
        ),
    );

    const dialog = h(
        "dialog",
        { class: "about", "aria-labelledby": "about-title" },
        h("div", { class: "about-head" }, h("h2", { id: "about-title" }, "Reunion Island Explorer"), langSwitch, close),
        h(
            "div",
            { class: "about-body" },
            p({
                en: "A 3D digital twin of La Réunion and its hiking trails: relief, aerial imagery, buildings and real trees, built entirely from open data.",
                fr: "Un jumeau numérique 3D de La Réunion et de ses sentiers de randonnée : relief, orthophotos, bâtiments et arbres réels, construit entièrement à partir de données ouvertes.",
            }),
            h("h3", {}, t({ en: "A demonstrator of the Horizon engine", fr: "Un démonstrateur du moteur Horizon" })),
            p(
                { en: "This application is a demonstrator of ", fr: "Cette application est un démonstrateur de " },
                a(LINKS.horizon, "Horizon"),
                { en: ", Siradel's open source geospatial 3D engine, which grew out of the ", fr: ", le moteur 3D géospatial open source de Siradel, issu de l'écosystème " },
                a(LINKS.sce, "SCE"),
                { en: " ecosystem.", fr: "." },
            ),
            h("h3", {}, t({ en: "An experiment, not a guide", fr: "Une expérimentation, pas un guide" })),
            p({
                en: "The data is reprocessed automatically and may contain errors, at the margin or more. Trail times, levels and routes are indicative and may be out of date: do not use this app to plan or follow a hike. Check trail closures with the ONF and the weather forecast before setting off.",
                fr: "Les données sont retraitées automatiquement et peuvent contenir des erreurs, à la marge ou plus. Durées, niveaux et tracés sont indicatifs et peuvent être périmés : ne vous servez pas de cette application pour préparer ou suivre une randonnée. Vérifiez les fermetures de sentiers auprès de l'ONF et la météo avant de partir.",
            }),
            p({
                en: "Reunion Island Explorer is not affiliated with the Région Réunion, Île de La Réunion Tourisme, the ONF, the Parc national de La Réunion or IGN.",
                fr: "Reunion Island Explorer n'est affilié ni à la Région Réunion, ni à Île de La Réunion Tourisme, ni à l'ONF, ni au Parc national de La Réunion, ni à l'IGN.",
            }),
            h("h3", {}, t({ en: "Privacy", fr: "Vie privée" })),
            p({
                en: "No account, no cookies, no analytics. Map tiles, place searches and elevation queries go directly from your browser to the IGN Géoplateforme. Your location, if you share it, is only used in your browser to move the view.",
                fr: "Ni compte, ni cookies, ni mesure d'audience. Les fonds de carte, les recherches de lieux et les altitudes sont demandés directement par votre navigateur à la Géoplateforme de l'IGN. Votre position, si vous la partagez, ne sert que dans votre navigateur à déplacer la vue.",
            }),
            sources,
            h(
                "footer",
                { class: "about-links" },
                h("a", { href: LINKS.siradel, target: "_blank", rel: "noopener", class: "about-logo", "aria-label": "Siradel" }),
                a(LINKS.repo, t({ en: "Source code", fr: "Code source" })),
                a(`mailto:${LINKS.contactEmail}`, LINKS.contactEmail),
            ),
        ),
    );
    dialog.querySelector(".about-logo")!.innerHTML = SIRADEL_LOGO;
    // A click on the backdrop (outside the box) closes the dialog.
    dialog.addEventListener("click", (e) => e.target === dialog && dialog.close());
    document.body.append(dialog);

    return {
        open(section) {
            dialog.showModal();
            if (section) sources.scrollIntoView({ block: "start" });
            else dialog.querySelector(".about-body")!.scrollTo(0, 0);
        },
    };
}
