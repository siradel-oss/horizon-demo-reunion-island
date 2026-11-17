// Look & camera of the digital twin: ambiances (sun, sky, haze), lens focal
// length, and an orbit camera locked around the island.

import type { Text } from "../i18n";
import { HrzApi } from "@siradel-oss/horizon-api";
import { HrzProtocol } from "@siradel-oss/horizon-protocol";
import type { Api } from "./horizon";

const VIEW = HrzProtocol.SceneViewIndex.SCENE_VIEW_0;
const CAMERA = HrzProtocol.CameraIndex.CAMERA_0;
const sceneView = () => HrzApi.SceneViewSettingsPathBuilder.create(VIEW);

// --- Ambiances ---------------------------------------------------------------

export interface Ambiance {
    id: string;
    label: Text;
    hint: Text;
    /** Local solar time, hours. */
    hour: number;
    /** Haze: 0 = crystal clear, 1 = thick mist hanging in the heights. */
    haze: number;
    hazeColor: { r: number; g: number; b: number };
}

export const AMBIANCES: Ambiance[] = [
    { id: "aube", label: { en: "Sunrise", fr: "Lever de soleil" }, hint: { en: "Summits light up above the sea of clouds", fr: "Les sommets s'allument au-dessus de la mer de nuages" }, hour: 7.4, haze: 0.45, hazeColor: { r: 0.98, g: 0.8, b: 0.68 } },
    { id: "midi", label: { en: "Clear blue sky", fr: "Grand ciel bleu" }, hint: { en: "Crisp light, turquoise lagoon", fr: "Lumière franche, lagon turquoise" }, hour: 11, haze: 0.08, hazeColor: { r: 0.78, g: 0.88, b: 0.97 } },
    { id: "brume", label: { en: "Highland mist", fr: "Brume des hauts" }, hint: { en: "Afternoon clouds cling to the cliffs", fr: "Les nuages de l'après-midi s'accrochent aux remparts" }, hour: 14.5, haze: 1, hazeColor: { r: 0.88, g: 0.9, b: 0.92 } },
    { id: "doree", label: { en: "Golden hour", fr: "Heure dorée" }, hint: { en: "The sun sinks into the ocean, on the west side", fr: "Le soleil plonge derrière l'océan, côté ouest" }, hour: 16.45, haze: 0.35, hazeColor: { r: 1, g: 0.72, b: 0.5 } },
];

// Mid-austral-winter dry season: clear skies, the hiking season.
export const DAY_OF_YEAR = 200;

/** Apply a full ambiance (sun, sky, ambient light, haze). */
export async function applyAmbiance(api: Api, a: Ambiance): Promise<void> {
    await sceneView()
        .ambient()
        .set(api, {
            sunAmbientBalance: 0.55,
            lightingStrength: 1.25,
            wrapLighting: 0.35,
            lighting: { enableLighting: true, castShadows: true, receiveShadows: true },
            sky: { mode: HrzProtocol.SkyMode.SKY_SIMULATED, attenuation: 0.15 },
            sun: {
                mode: HrzProtocol.SunLightingMode.SUN_LIGHTING_SIMULATED,
                // Local solar time (atPrimeMeridian false) on a fixed day of the year.
                solarDate: { solarTime: a.hour, atPrimeMeridian: false, dayOfYear: DAY_OF_YEAR },
            },
            ambientLighting: { mode: HrzProtocol.AmbientLightingMode.AMBIENT_LIGHTING_SIMULATED },
            primaryFog: fog(a),
        });
}

/**
 * Haze as a height fog: denser near sea level and in the cirques, thinning above
 * the ridges. Density 1 saturates in ~1 km, so island-scale haze stays far below.
 */
function fog(a: Ambiance): HrzProtocol.FogSettings.$Properties {
    return {
        color: { ...a.hazeColor, a: 1 },
        density: 0.0008 + 0.006 * a.haze,
        startDistance: 6000 - 4500 * a.haze,
        falloffStart: 300 + 1200 * a.haze,
        falloffEnd: 2000 + 2000 * a.haze,
        applyToSky: false,
    };
}

/** Bare terrain colour = IGN's open-sea tint, so a missing ortho tile reads as ocean. */
export async function initTerrainLook(api: Api): Promise<void> {
    await sceneView().terrain().terrainColor().set(api, { r: 0.043, g: 0.227, b: 0.353, a: 1 });
}

/** Move the sun only (time-of-day slider). */
export function setSunHour(api: Api, hour: number): void {
    void sceneView().ambient().sun().solarDate().solarTime().set(api, hour);
}

// --- Lens --------------------------------------------------------------------

/** Full-frame equivalent focal length (mm) → vertical field of view (degrees). */
export const focalToFovy = (mm: number): number => (2 * Math.atan(12 / mm) * 180) / Math.PI;

export function setFocal(api: Api, mm: number): void {
    void HrzApi.CameraSettingsPathBuilder.create(CAMERA).fovy().set(api, focalToFovy(mm));
}

export async function initCamera(api: Api, focalMm: number): Promise<void> {
    await HrzApi.CameraSettingsPathBuilder.create(CAMERA).set(api, {
        fovy: focalToFovy(focalMm),
        userControlsInertia: 0.12,
        movementsInertia: 0.06,
        // Never dive under the ramparts of the cirques.
        minHeightAboveTerrain: 25,
        terrainCollisionInertia: 0.15,
    });
}

// --- Camera ------------------------------------------------------------------

/** The window the visitor can never leave: the island plus a ring of ocean. */
const ISLAND_LIMITS = { west: 54.95, south: -21.62, east: 56.1, north: -20.62 };
const MAX_ALTITUDE = 140_000;

/** Whether a position is on the island (its land bounding box). */
export const isOnIsland = (lon: number, lat: number) => lon >= 55.2 && lon <= 55.86 && lat >= -21.42 && lat <= -20.85;

export interface Viewpoint {
    lat: number;
    lon: number;
    /** Altitude of the target point, meters. */
    alt: number;
    /** Distance camera → target, meters. */
    distance: number;
    /** Degrees, compass heading of the camera. */
    bearing: number;
    /** Degrees from nadir (0 = looking straight down). */
    tilt: number;
}

/** Overview: from the south-east, the volcano in front, Piton des Neiges behind. */
export const ISLAND_VIEW: Viewpoint = { lat: -21.13, lon: 55.53, alt: 800, distance: 82_000, bearing: -28, tilt: 52 };

const rad = (deg: number) => (deg * Math.PI) / 180;

const orbitLimits = {
    cameraIndex: CAMERA,
    limitBounds: ISLAND_LIMITS,
    maxAltitude: MAX_ALTITUDE,
    minTilt: 0,
    maxTilt: rad(84),
    isInterruptible: true,
    correctionAnimation: { duration: 0 },
};

function angular(v: Viewpoint): HrzProtocol.AngularViewpoint.$Properties {
    return {
        target: { latitude: v.lat, longitude: v.lon, altitude: v.alt },
        distance: v.distance,
        bearing: rad(v.bearing),
        tilt: rad(v.tilt),
    };
}

/** Fly to a viewpoint, staying inside the island window. */
export function flyTo(api: Api, v: Viewpoint, seconds = 3.2): void {
    void api.CameraService.setOrbit({
        ...orbitLimits,
        angularViewpoint: angular(v),
        goToAnimation: {
            duration: seconds,
            easingFunction: HrzProtocol.EasingFunctions.EASE_INOUT,
            easingExponent: 2.2,
            trajectoryType: HrzProtocol.TrajectoryType.BALLISTIC,
        },
    });
}

/** Frame a lon/lat bounding box with an oblique view. */
export function flyToBox(api: Api, [w, s, e, n]: [number, number, number, number], alt: number, bearing = -20): void {
    const span = Math.max((e - w) * 104_000, (n - s) * 111_000);
    flyTo(api, { lat: (s + n) / 2, lon: (w + e) / 2, alt, distance: Math.max(2200, span * 1.7), bearing, tilt: 55 });
}

/** Fly to a place keeping the current compass heading (no disorienting spin). */
export async function flyToPlace(api: Api, p: { lat: number; lon: number; alt: number }, distance: number, tilt = 62): Promise<void> {
    const current = await api.CameraService.getCameraAngularViewpoint({ camera: CAMERA });
    flyTo(api, { lat: p.lat, lon: p.lon, alt: p.alt, distance, bearing: ((current.bearing ?? 0) * 180) / Math.PI, tilt }, 3);
}

/**
 * Slow orbit around the point at the centre of the screen (contemplative mode).
 * Returns a stop function; any user gesture on the view should call it.
 */
export async function startSpin(api: Api, degreesPerSecond = 2.4): Promise<() => void> {
    const v = await api.CameraService.getCameraAngularViewpoint({ camera: CAMERA });
    let bearing = v.bearing ?? 0;
    let last = 0;
    let raf = requestAnimationFrame(function frame(now) {
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
        last = now;
        bearing += rad(degreesPerSecond) * dt;
        void api.CameraService.setOrbit({ ...orbitLimits, angularViewpoint: { target: v.target, distance: v.distance, tilt: v.tilt, bearing } });
        raf = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(raf);
}

// --- Navigation controls (bottom-right widget) -----------------------------
// Same calls and factors as the Horizon gallery's NavigationControls.

const TANGENTIAL = HrzProtocol.CameraFrame.CAMERA_FRAME_TANGENTIAL;

export function navigation(api: Api) {
    const cam = HrzProtocol.CameraIndex.CAMERA_0;
    return {
        async readState() {
            const [pose, view] = await Promise.all([
                api.CameraService.getCameraPose({ camera: cam }),
                api.CameraService.getSceneViewScaleAndAltitude({ sceneView: VIEW }),
            ]);
            return { bearing: pose.bearing ?? 0, altitude: view.altitudeAbsolute ?? 0 };
        },
        step: (x: number, y: number) =>
            void api.CameraService.move({ cameraIndex: cam, translation: { angleFactorX: x * 0.5, angleFactorY: y * 0.5, frame: TANGENTIAL } }),
        beginMove: (x: number, y: number) =>
            void api.CameraService.beginContinuousMovement({ cameraIndex: cam, translation: { angleFactorX: x, angleFactorY: y, frame: TANGENTIAL } }),
        zoomStep: (direction: number) => void api.CameraService.move({ cameraIndex: cam, zoom: { ratio: 2 ** (direction * 0.75) } }),
        beginZoom: (direction: number) => void api.CameraService.beginContinuousMovement({ cameraIndex: cam, zoom: { ratio: 2 ** direction } }),
        beginRotate: (bearing: number, tilt: number) => void api.CameraService.beginContinuousMovement({ cameraIndex: cam, rotation: { bearing, tilt } }),
        endMove() {
            for (const movement of [{ translation: {} }, { zoom: {} }, { rotation: {} }])
                void api.CameraService.endContinuousMovement({ cameraIndex: cam, ...movement });
        },
    };
}

/**
 * North up, keeping target, distance and tilt: the relief stays in perspective.
 * Not CameraService.resetNorth: on this locked orbit it leaves a black view.
 */
export async function resetNorth(api: Api): Promise<void> {
    const v = await api.CameraService.getCameraAngularViewpoint({ camera: CAMERA });
    void api.CameraService.setOrbit({
        ...orbitLimits,
        angularViewpoint: { target: v.target, distance: v.distance, tilt: v.tilt, bearing: 0 },
        goToAnimation: { duration: 1, easingFunction: HrzProtocol.EasingFunctions.EASE_INOUT, easingExponent: 2, trajectoryType: HrzProtocol.TrajectoryType.INTERPOLATED },
    });
}

/** Re-apply the island lock to the current view (after a fixed-position flight). */
export function lockToIsland(api: Api): void {
    void api.CameraService.setOrbit({ ...orbitLimits, current: {} });
}

/**
 * Opening shot: start far above the Indian Ocean (outside the island window),
 * then dive onto the island. The caller locks the camera once it lands.
 */
export async function introFlight(api: Api, seconds: number): Promise<void> {
    await api.CameraService.setOrbit({
        cameraIndex: CAMERA,
        maxAltitude: 1e8,
        minTilt: 0,
        maxTilt: Math.PI / 2,
        angularViewpoint: angular({ lat: -24, lon: 57.5, alt: 0, distance: 5_200_000, bearing: -30, tilt: 0 }),
    });
    await api.CameraService.setOrbit({
        cameraIndex: CAMERA,
        maxAltitude: 1e8,
        minTilt: 0,
        maxTilt: Math.PI / 2,
        isInterruptible: false,
        angularViewpoint: angular(ISLAND_VIEW),
        goToAnimation: {
            duration: seconds,
            easingFunction: HrzProtocol.EasingFunctions.EASE_INOUT,
            easingExponent: 2.5,
            trajectoryType: HrzProtocol.TrajectoryType.BALLISTIC,
        },
    });
}

/** Free camera pose for scripted flights (camera position + look-at target). */
export function setCameraLookAt(
    api: Api,
    from: { lat: number; lon: number; alt: number },
    to: { lat: number; lon: number; alt: number },
): void {
    void api.CameraService.setFixedPosition({
        cameraIndex: CAMERA,
        minTilt: 0,
        maxTilt: Math.PI,
        positionalViewpoint: {
            position: { latitude: from.lat, longitude: from.lon, altitude: from.alt },
            target: { latitude: to.lat, longitude: to.lon, altitude: to.alt },
        },
    });
}

export function setUserInteractions(api: Api, enabled: boolean): void {
    void api.ViewerService.setUserInteractionsEnabled({ value: enabled });
}

/** Periodic hover info (feeds the trail tooltip). No engine highlight: it would also light up buildings. */
export function initHover(api: Api): void {
    void api.ViewerService.configureMouseHover({ enableHighlight: false, enableInfo: true, highlightRateMs: 100, infoRateMs: 80 });
}
