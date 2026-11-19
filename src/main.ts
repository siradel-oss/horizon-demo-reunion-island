// Reunion Island Explorer — wiring: engine boot, opening flight, the three modules
// (Explore / To see / Hike), hover and click on the 3D view.

import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "@fontsource-variable/figtree";
import "./style.css";
import { setLang, t, type Lang } from "./i18n";
import { HrzApi } from "@siradel-oss/horizon-api";
import { HrzProtocol } from "@siradel-oss/horizon-protocol";
import { categoryOf, loadPois, type PoisDataset } from "./data/pois";
import { groundAltitude } from "./data/geocode";
import { lightAlong, loadSun, type SunDataset } from "./data/sun";
import { allPoints, formatKm, formatM, loadTrails, pointAt, type TrailsDataset } from "./data/trails";
import { boot, onEngineMessage, type Api } from "./engine/horizon";
import { addBuildings, addOrthophoto, addTerrain, serveTerrainAsset } from "./engine/layers";
import { pickAt } from "./engine/pick";
import { addPlaceMarker, type PlaceMarker } from "./engine/place-marker";
import { addPoiLayers, type PoiLayers } from "./engine/poi-layers";
import {
    AMBIANCES,
    DAY_OF_YEAR,
    ISLAND_VIEW,
    applyAmbiance,
    flyTo,
    flyToBox,
    flyToPlace,
    setOcclusion,
    initCamera,
    initHover,
    initTerrainLook,
    introFlight,
    isOnIsland,
    lockToIsland,
    navigation,
    resetNorth,
    setFocal,
    setSunHour,
    startSpin,
} from "./engine/scene";
import { startTour, type Tour } from "./engine/tour";
import { addTrailLayers, type TrailLayers } from "./engine/trail-layers";
import { addTrees, type Trees } from "./engine/trees";
import { PHONE } from "./engine/device";
import { createAmbiancePanel, formatHour } from "./ui/ambiance-panel";
import { createNavControls } from "./ui/nav-controls";
import { createAbout } from "./ui/about";
import { $, h } from "./ui/dom";
import { createExplorePanel } from "./ui/explore-panel";
import { createHikePanel } from "./ui/hike-panel";
import { createPoiPanel } from "./ui/poi-panel";
import { mountProfile, type Profile } from "./ui/profile";
import { createSearchBox } from "./ui/search-box";
import { createSheet, PHONE_LAYOUT } from "./ui/sheet";
import { createSunStrip, type SunStrip } from "./ui/sun-strip";
import { createTourControls } from "./ui/tour-controls";
import { SIRADEL_LOGO } from "./ui/siradel-logo";
import { LINKS } from "./links";

// URL options for demos: ?ambiance=aube|midi|brume|doree, ?intro=0 skips the opening flight,
// ?lang=en|fr (see i18n.ts).
const params = new URLSearchParams(location.search);
const INTRO_SECONDS = params.get("intro") === "0" ? 0.1 : 9;
const START_AMBIANCE = AMBIANCES.find((a) => a.id === params.get("ambiance")) ?? AMBIANCES.find((a) => a.id === "doree")!;
const START_FOCAL = 35;
// A searched place is framed from higher up than the curated shots: in the
// cirques an oblique view would often hide it behind a ridge.
const SEARCH_TILT = 45;
/** Radius (CSS px) of the ring of extra picks around a tap. */
const TOUCH_SLOP_PX = 12;

type Tab = "explore" | "poi" | "hike";

const canvas = $<HTMLCanvasElement>("#viewer");
const panel = $("#panel");
const panelBody = $("#panel .panel-body");
const dock = $("#dock");
const ambianceBox = $("#ambiance");
const ambianceToggle = $<HTMLButtonElement>(".ambiance-toggle");
const hoverTip = $("#hover-tip");
const introStatus = $(".intro-status");

// The canvas size is left to the engine: it watches the canvas and applies the
// device pixel ratio itself (sizing it here too made it apply the ratio twice:
// touches only reached the top of the view, draped lines got too wide).

// Static texts of index.html, in the current language.
const STATIC: [selector: string, text: Parameters<typeof t>[0], attr?: string][] = [
    [".intro-title p", { en: "Three cirques, two volcanoes, a thousand kilometres of trails.", fr: "Trois cirques, deux volcans, mille kilomètres de sentiers." }],
    [".intro-status", { en: "Loading the relief…", fr: "Chargement du relief…" }],
    [".tabs", { en: "Mode", fr: "Mode" }, "aria-label"],
    ['[data-tab="explore"]', { en: "Explore", fr: "Explorer l'île" }],
    ['[data-tab="poi"]', { en: "To see", fr: "À voir" }],
    ['[data-tab="hike"]', { en: "Hike", fr: "Randonner" }],
    [".ambiance-toggle", { en: "Mood", fr: "Ambiance" }],
    [".fullscreen-toggle", { en: "Full screen", fr: "Plein écran" }, "title"],
    [".fullscreen-toggle", { en: "Full screen", fr: "Plein écran" }, "aria-label"],
    [".about-toggle", { en: "About and sources", fr: "À propos et sources" }, "title"],
    [".about-toggle", { en: "About and sources", fr: "À propos et sources" }, "aria-label"],
    [".lang-toggle", { en: "Version française", fr: "English version" }, "title"],
    [".leave-immersive", { en: "Exit full screen", fr: "Quitter le plein écran" }],
    [".sheet-handle", { en: "Expand the panel", fr: "Agrandir le panneau" }, "aria-label"],
    ["#ambiance", { en: "Mood settings", fr: "Réglages d'ambiance" }, "aria-label"],
    ["#dock", { en: "Elevation profile", fr: "Profil altimétrique" }, "aria-label"],
    ["#viewer", { en: "3D view of La Réunion", fr: "Vue 3D de La Réunion" }, "aria-label"],
    [".credits-sources", { en: "IGN Géoplateforme · © OpenStreetMap contributors · Wikipedia — sources and licences", fr: "IGN Géoplateforme · © contributeurs OpenStreetMap · Wikipédia — sources et licences" }],
];
for (const [sel, text, attr] of STATIC) {
    const el = $(sel);
    if (attr) el.setAttribute(attr, t(text));
    else el.textContent = t(text);
}
$(".intro-logo").innerHTML = SIRADEL_LOGO;
$(".credits-logo").innerHTML = SIRADEL_LOGO;
$<HTMLAnchorElement>(".credits-logo").href = LINKS.siradel;

const about = createAbout();
$(".about-toggle").addEventListener("click", () => about.open());
$(".credits-sources").addEventListener("click", () => about.open("sources"));
$(".lang-toggle").textContent = t({ en: "FR", fr: "EN" });
$(".lang-toggle").setAttribute("lang", t({ en: "fr", fr: "en" }));
$(".lang-toggle").addEventListener("click", () => setLang(t({ en: "fr", fr: "en" }) as Lang));

async function main() {
    const [api, trailsData, poisData, sunData] = await Promise.all([boot(canvas), loadTrails(), loadPois(), loadSun()]);
    onEngineMessage((m) => m.assetRequest && serveTerrainAsset(api, m.assetRequest));
    // Dev only: drive the engine from the browser console.
    if (import.meta.env.DEV) Object.assign(window, { hrz: { api, HrzApi, HrzProtocol } });

    // No 3D trees on phones: too heavy for their memory and GPU.
    const noTrees: Trees = { setVisible() {} };
    const [trees] = await Promise.all([PHONE ? noTrees : addTrees(api), addTerrain(api), addOrthophoto(api), addBuildings(api)]);
    const trailLayers = await addTrailLayers(api, trailsData.trails, trailsData.attribution);
    const poiLayers = await addPoiLayers(api, poisData.attribution);
    const marker = await addPlaceMarker(api);
    // The opening and "Explore" show the landscape alone.
    trailLayers.setVisible(false);
    poiLayers.setVisible(false);
    trees.setVisible(false); // on demand, from a trail sheet
    await initTerrainLook(api);
    await applyAmbiance(api, START_AMBIANCE);
    await initCamera(api, START_FOCAL);
    initHover(api);

    introStatus.textContent = "";
    $("#intro").classList.add("flying");
    await introFlight(api, INTRO_SECONDS);
    setTimeout(() => $("#intro").classList.add("leaving"), Math.max(0, INTRO_SECONDS - 3.2) * 1000);
    setTimeout(() => {
        lockToIsland(api);
        $("#intro").remove();
        startUi(api, trailsData, poisData, sunData, trailLayers, poiLayers, trees, marker);
    }, INTRO_SECONDS * 1000 + 150);
}

function startUi(
    api: Api,
    trailsData: TrailsDataset,
    poisData: PoisDataset,
    sunData: SunDataset,
    trailLayers: TrailLayers,
    poiLayers: PoiLayers,
    trees: Trees,
    marker: PlaceMarker,
) {
    const { trails, zones } = trailsData;
    const { pois } = poisData;
    const zoneLabel = (id: string) => zones.find((z) => z.id === id)?.label ?? "";
    let tab: Tab = "explore";
    let selectedTrail = -1;
    let tour: Tour | null = null;
    let profile: Profile | null = null;
    const sheet = createSheet(panel, $(".sheet-handle"));
    // Phone: frame flights in the band between the search bar and the bottom sheet
    // (plus the trail profile floating over a folded sheet).
    setOcclusion(() => {
        if (!PHONE_LAYOUT.matches) return { top: 0, bottom: 0 };
        const bar = innerHeight - $(".tabs").getBoundingClientRect().top;
        const profile = dock.hidden || sheet.state !== "mini" ? 0 : dock.getBoundingClientRect().height + 10;
        return { top: $(".topbar").getBoundingClientRect().bottom, bottom: bar + sheet.height + profile };
    });
    let sunStrip: SunStrip | null = null;
    let hour = START_AMBIANCE.hour;
    let treesOn = false;

    /** Sun profile of the selected trail at the current solar hour. */
    function refreshSun() {
        if (!sunStrip || selectedTrail < 0) return;
        const trail = trails[selectedTrail];
        const lat = (trail.bbox[1] + trail.bbox[3]) / 2;
        sunStrip.update(lightAlong(sunData.trails[selectedTrail], sunData.directions, lat, DAY_OF_YEAR, hour), formatHour(hour));
    }
    let stopSpin: (() => void) | null = null;

    const halt = () => {
        tour?.stop();
        tour = null;
        stopSpin?.();
        stopSpin = null;
        explore.setSpinning(false);
    };

    // --- Explore: the landscape alone ------------------------------------------

    const explore = createExplorePanel({
        onPlace: (p) => {
            halt();
            flyTo(api, p.view, 4);
        },
        onOverview: () => {
            halt();
            flyTo(api, ISLAND_VIEW, 3.5);
        },
        onSpin: async (on) => {
            halt();
            if (on) {
                stopSpin = await startSpin(api);
                explore.setSpinning(true);
            }
        },
    });

    // --- Navigation: full screen, compass and moves -------------------------------

    function setImmersive(on: boolean) {
        document.body.classList.toggle("immersive", on);
        if (on) void document.documentElement.requestFullscreen?.().catch(() => {});
        else if (document.fullscreenElement) void document.exitFullscreen();
    }
    document.addEventListener("fullscreenchange", () => !document.fullscreenElement && setImmersive(false));
    $(".leave-immersive").addEventListener("click", () => setImmersive(false));
    $(".fullscreen-toggle").addEventListener("click", () => setImmersive(true));

    $("#nav").append(
        createNavControls({
            ...navigation(api),
            onResetNorth: () => void resetNorth(api),
            onInteract: halt,
        }),
    );

    // --- To see ----------------------------------------------------------------

    function selectPoi(i: number) {
        halt();
        setTab("poi");
        poi.showPoi(i);
        poiLayers.select(i);
        sheet.set("half");
        const p = pois[i];
        void flyToPlace(api, p, categoryOf(p.cat).distance);
    }

    const poi = createPoiPanel(poisData, trails, zoneLabel, {
        onSelect: selectPoi,
        onBack: () => {
            poiLayers.select(-1);
            poi.showList();
        },
        onRefocus: (i) => void flyToPlace(api, pois[i], categoryOf(pois[i].cat).distance),
        onFilter: (active) => poiLayers.filter(active),
        onOpenTrail: (i) => selectTrail(i),
    });

    // --- Hike -------------------------------------------------------------

    function selectTrail(i: number) {
        halt();
        selectedTrail = i;
        setTab("hike");
        hike.showTrail(i);
        trailLayers.select(i);
        trailLayers.setHiker(null);
        const trail = trails[i];
        // Phone: fold the sheet to its header; the profile shows above it.
        sheet.set("mini");

        const points = allPoints(trail);
        dock.hidden = false;
        const sun = sunData.trails[i];
        sunStrip = createSunStrip(sun.d, points[points.length - 1][3]);
        dock.replaceChildren(
            h(
                "div",
                { class: "dock-head" },
                h("h3", {}, trail.name),
                h("p", {}, t({ en: "Click or drag on the profile: the camera moves there", fr: "Cliquez ou glissez sur le profil : la caméra s'y place" })),
                tourControls.element,
            ),
            h("div", { class: "dock-chart" }),
            sunStrip.element,
        );
        profile?.destroy();
        profile = mountProfile(
            dock.querySelector(".dock-chart")!,
            points,
            (d) => {
                if (!tour) trailLayers.setHiker(d == null ? null : pointAt(points, d));
            },
            seekFromProfile,
        );
        refreshSun();
        // Once the sheet and profile are in place: the flight frames the trail above them.
        flyToBox(api, trail.bbox, (trail.altMin + trail.altMax) / 2);
    }

    function clearTrail() {
        halt();
        selectedTrail = -1;
        trailLayers.select(-1);
        trailLayers.setHiker(null);
        profile?.destroy();
        profile = null;
        sunStrip = null;
        dock.hidden = true;
        hike.showList();
        sheet.set("half");
        flyTo(api, ISLAND_VIEW);
    }

    // --- Drone flight ------------------------------------------------------------

    let tourRate = 1;
    /** Whether the flight resumes when the profile is released. */
    let resumeAfterSeek = false;

    const tourControls = createTourControls({
        onPlay(play) {
            tour?.setPaused(!play);
            syncTour();
        },
        onRate(rate) {
            tourRate = rate;
            tour?.setRate(rate);
            syncTour();
        },
        onStop: () => halt(),
    });
    const syncTour = () => tourControls.sync(tour && { paused: tour.paused, rate: tourRate });

    function startTourAt(i: number, from: number, paused: boolean) {
        halt();
        const points = allPoints(trails[i]);
        let lastMarker = 0;
        hike.setTouring(true);
        document.body.classList.add("touring");
        tour = startTour(
            api,
            trails[i],
            {
                onProgress(d, hiker) {
                    profile?.setCursor(d);
                    // Each update rebuilds the marker tile: a few Hz keeps it on screen
                    // (the camera already follows the hiker smoothly).
                    const now = performance.now();
                    if (now - lastMarker > 250) {
                        lastMarker = now;
                        trailLayers.setHiker(hiker);
                    }
                },
                onEnd() {
                    tour = null;
                    syncTour();
                    hike.setTouring(false);
                    document.body.classList.remove("touring");
                    trailLayers.setHiker(pointAt(points, points[points.length - 1][3]));
                },
            },
            { from, paused },
        );
        tour.setRate(tourRate);
        syncTour();
    }

    function toggleTour(i: number) {
        if (tour) halt();
        else startTourAt(i, 0, false);
    }

    /** The profile drives the drone: a press places it (paused), a drag scrubs. */
    function seekFromProfile(d: number, phase: "start" | "move" | "end") {
        if (selectedTrail < 0) return;
        if (phase === "start") {
            if (!tour) {
                startTourAt(selectedTrail, d, true);
                resumeAfterSeek = false;
                return;
            }
            resumeAfterSeek = !tour.paused;
            tour.setPaused(true);
        }
        tour?.seek(d);
        if (phase === "end" && resumeAfterSeek) tour?.setPaused(false);
        syncTour();
    }

    const hike = createHikePanel(trailsData, pois, {
        onSelect: selectTrail,
        onBack: clearTrail,
        onFly: toggleTour,
        onFrame: (i) => {
            halt();
            const trail = trails[i];
            flyToBox(api, trail.bbox, (trail.altMin + trail.altMax) / 2);
        },
        // List preview: draw the hovered trail on the relief.
        onHoverRow: (i) => trailLayers.select(i ?? selectedTrail),
        onOpenPoi: (i) => selectPoi(i),
        onTrees: (on) => {
            treesOn = on;
            trees.setVisible(on && tab === "hike");
        },
    });

    // --- Tabs ------------------------------------------------------------------

    function setTab(next: Tab) {
        const changed = next !== tab;
        if (changed) halt();
        tab = next;
        document.querySelectorAll<HTMLButtonElement>(".tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
        panelBody.replaceChildren({ explore: explore.element, poi: poi.element, hike: hike.element }[tab]);
        // Phone: a new module opens the sheet halfway (a selected trail folds it, see selectTrail).
        if (changed) sheet.set("half");
        document.body.dataset.tab = tab;
        // Each module shows only its own layer.
        trailLayers.setVisible(tab === "hike");
        poiLayers.setVisible(tab === "poi");
        trees.setVisible(treesOn && tab === "hike");
        dock.hidden = tab !== "hike" || selectedTrail < 0;
        hoverTip.hidden = true;
    }
    document.querySelectorAll<HTMLButtonElement>(".tab").forEach((b) =>
        b.addEventListener("click", () => {
            // Phone: the current tab closes the sheet (map only) and opens it again.
            if (b.dataset.tab === tab && PHONE_LAYOUT.matches) sheet.set(sheet.state === "closed" ? "half" : "closed");
            else setTab(b.dataset.tab as Tab);
        }),
    );

    // --- Place search (IGN) and own position ------------------------------------

    const search = createSearchBox({
        async onPick(place) {
            halt();
            marker.set({ lon: place.lon, lat: place.lat, kind: 0 });
            void flyToPlace(api, { lon: place.lon, lat: place.lat, alt: await groundAltitude(place.lon, place.lat) }, place.distance, SEARCH_TILT);
        },
        onLocate() {
            if (!navigator.geolocation) {
                search.setStatus(t({ en: "This browser does not share its location.", fr: "Ce navigateur ne donne pas sa position." }));
                return;
            }
            search.setStatus(t({ en: "Locating…", fr: "Localisation…" }));
            navigator.geolocation.getCurrentPosition(
                async ({ coords: { longitude: lon, latitude: lat } }) => {
                    if (!isOnIsland(lon, lat)) {
                        search.setStatus(t({ en: "You are not in La Réunion: the view stays on the island.", fr: "Vous n'êtes pas à La Réunion : la vue reste sur l'île." }));
                        return;
                    }
                    search.setStatus("");
                    halt();
                    marker.set({ lon, lat, kind: 1 });
                    void flyToPlace(api, { lon, lat, alt: await groundAltitude(lon, lat) }, 1500, SEARCH_TILT);
                },
                (err) =>
                    search.setStatus(
                        err.code === err.PERMISSION_DENIED
                            ? t({ en: "Location access denied by the browser.", fr: "Géolocalisation refusée par le navigateur." })
                            : t({ en: "Location unavailable.", fr: "Position indisponible." }),
                    ),
                { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
            );
        },
        onClear: () => {
            marker.set(null);
            search.setStatus("");
        },
    });
    ambianceToggle.before(search.element);

    // --- Ambiance --------------------------------------------------------------

    ambianceBox.append(
        createAmbiancePanel(
            { ambiance: START_AMBIANCE, focal: START_FOCAL },
            {
                onAmbiance: (a) => {
                    void applyAmbiance(api, a);
                    hour = a.hour;
                    refreshSun();
                },
                onHour: (h) => {
                    setSunHour(api, h);
                    hour = h;
                    refreshSun();
                },
                onFocal: (mm) => setFocal(api, mm),
            },
        ),
    );
    ambianceToggle.addEventListener("click", () => {
        ambianceBox.hidden = !ambianceBox.hidden;
        ambianceToggle.setAttribute("aria-expanded", String(!ambianceBox.hidden));
    });
    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (document.body.classList.contains("immersive")) setImmersive(false);
        else if (!ambianceBox.hidden) ambianceToggle.click();
        else halt();
    });

    // --- Hover & click on the 3D view ------------------------------------------

    // What the pointer is over, in the current module.
    let hovered: { kind: "trail" | "poi"; index: number } | null = null;
    let mouse = { x: 0, y: 0 };
    canvas.addEventListener("pointermove", (e) => (mouse = { x: e.clientX, y: e.clientY }));
    canvas.addEventListener("pointerleave", () => {
        hovered = null;
        hoverTip.hidden = true;
    });
    onEngineMessage((m) => {
        if (!m.mouseHoverInfo || tour) return;
        const ref = m.mouseHoverInfo.picked?.vectorTiles;
        const trail = tab === "hike" ? trailLayers.trailIndexOf(ref) : -1;
        const place = tab === "poi" ? poiLayers.poiIndexOf(ref) : -1;
        hovered = trail >= 0 ? { kind: "trail", index: trail } : place >= 0 ? { kind: "poi", index: place } : null;
        canvas.style.cursor = hovered ? "pointer" : "";
        if (!hovered) {
            hoverTip.hidden = true;
            return;
        }
        if (hovered.kind === "trail") {
            const trail = trails[hovered.index];
            hoverTip.replaceChildren(h("strong", {}, trail.name), h("span", {}, `${formatKm(trail.distanceKm)}, D+ ${formatM(trail.ascent)}`));
        } else {
            const p = pois[hovered.index];
            hoverTip.replaceChildren(h("strong", {}, p.name), h("span", {}, `${t(categoryOf(p.cat).one)}, ${zoneLabel(p.zone)}`));
        }
        hoverTip.style.transform = `translate(${mouse.x + 14}px, ${mouse.y + 14}px)`;
        hoverTip.hidden = false;
    });

    // A click (not a drag) selects what is hovered; any gesture stops the slow orbit.
    let down = { x: 0, y: 0 };
    canvas.addEventListener("pointerdown", (e) => {
        down = { x: e.clientX, y: e.clientY };
        if (stopSpin) halt();
    });
    canvas.addEventListener("wheel", () => stopSpin && halt(), { passive: true });
    canvas.addEventListener("pointerup", async (e) => {
        if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5 || tour) return;
        if (e.pointerType === "mouse") {
            if (hovered?.kind === "trail") selectTrail(hovered.index);
            else if (hovered) selectPoi(hovered.index);
            return;
        }
        // Touch: no hover, pick under the finger. A finger is wide and a trail
        // is a few pixels: also try a ring around the touch point.
        if (tab === "explore") return;
        const ring = [[0, 0], ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => [Math.cos((k * Math.PI) / 4) * TOUCH_SLOP_PX, Math.sin((k * Math.PI) / 4) * TOUCH_SLOP_PX])];
        const picks = await Promise.all(ring.map(([dx, dy]) => pickAt(api, canvas, e.clientX + dx, e.clientY + dy)));
        for (const ref of picks.flat()) {
            const trail = tab === "hike" ? trailLayers.trailIndexOf(ref) : -1;
            const place = tab === "poi" ? poiLayers.poiIndexOf(ref) : -1;
            if (trail >= 0) return selectTrail(trail);
            if (place >= 0) return selectPoi(place);
        }
    });

    // --- Reveal ----------------------------------------------------------------

    setTab("explore");
    for (const sel of [".topbar", "#panel", "#nav", ".credits"]) $(sel).hidden = false;
    lockToIsland(api);
}

main().catch((err) => {
    console.error(err);
    const reason = err instanceof Error ? err.message : String(err);
    introStatus.textContent = t({
        en: `The 3D view could not start: ${reason}. Use a recent browser with WebGL 2 enabled.`,
        fr: `La vue 3D n'a pas pu démarrer : ${reason}. Utilisez un navigateur récent avec WebGL 2 activé.`,
    });
    introStatus.classList.add("error");
});
