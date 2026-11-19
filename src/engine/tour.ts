// "Survol": a scripted drone flight following a trail, from start to finish.
// The camera trails the hiker from behind and above; its heading is low-pass
// filtered so switchbacks do not shake the shot. The flight can be paused,
// sped up or slowed down, and moved to any distance (the elevation profile
// drives it).

import { allPoints, pointAt, type Trail, type TrailPoint } from "../data/trails";
import type { Api } from "./horizon";
import { flyTo, lockToIsland, setCameraLookAt, setUserInteractions } from "./scene";

const BACK_M = 650; // camera distance behind the hiker
const UP_M = 380; // camera height above the hiker
const CHORD_M = 450; // half-length of the chord giving the walking direction
const HEADING_SMOOTHING = 1.8; // seconds (time constant)
const APPROACH_S = 3;

const M_PER_DEG = 111_320;

export interface TourCallbacks {
    onProgress(distance: number, hiker: TrailPoint): void;
    onEnd(): void;
}

export interface TourOptions {
    /** Distance to start from (m). */
    from?: number;
    /** Start paused: the camera waits at `from`. */
    paused?: boolean;
}

export interface Tour {
    stop(): void;
    /** Jump to a distance along the trail (m); the camera follows at once. */
    seek(distance: number): void;
    setPaused(paused: boolean): void;
    readonly paused: boolean;
    /** Speed multiplier (1 = normal pace). */
    setRate(rate: number): void;
}

/** Normal pace: about a minute for a short walk, five minutes at most. */
const tourSeconds = (km: number) => Math.min(300, Math.max(60, 45 + km * 7));

/** Heading (unit vector, meters east/north) of the chord around distance `d`. */
function heading(points: TrailPoint[], d: number): [number, number] {
    const a = pointAt(points, d - CHORD_M);
    const b = pointAt(points, d + CHORD_M);
    const east = (b[0] - a[0]) * M_PER_DEG * Math.cos((a[1] * Math.PI) / 180);
    const north = (b[1] - a[1]) * M_PER_DEG;
    const n = Math.hypot(east, north) || 1;
    return [east / n, north / n];
}

export function startTour(api: Api, trail: Trail, cb: TourCallbacks, options: TourOptions = {}): Tour {
    const points = allPoints(trail);
    const length = points[points.length - 1][3];
    const speed = length / tourSeconds(trail.distanceKm);

    let d = Math.min(length, Math.max(0, options.from ?? 0));
    let paused = options.paused ?? false;
    let rate = 1;
    let dir = heading(points, d);
    let raf = 0;
    let stopped = false;
    let last = 0;

    const start = pointAt(points, d);
    setUserInteractions(api, false);
    flyTo(
        api,
        {
            lat: start[1],
            lon: start[0],
            alt: start[2],
            distance: Math.hypot(BACK_M, UP_M),
            bearing: (Math.atan2(dir[0], dir[1]) * 180) / Math.PI,
            tilt: (Math.atan2(BACK_M, UP_M) * 180) / Math.PI,
        },
        APPROACH_S,
        true,
    );

    const frame = (now: number) => {
        if (stopped) return;
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
        last = now;
        if (!paused) d = Math.min(length, d + speed * rate * dt);

        const target = heading(points, d);
        const k = 1 - Math.exp(-dt / HEADING_SMOOTHING);
        dir = [dir[0] + (target[0] - dir[0]) * k, dir[1] + (target[1] - dir[1]) * k];
        const n = Math.hypot(dir[0], dir[1]) || 1;

        const hiker = pointAt(points, d);
        const cosLat = Math.cos((hiker[1] * Math.PI) / 180);
        setCameraLookAt(
            api,
            {
                lon: hiker[0] - ((dir[0] / n) * BACK_M) / (M_PER_DEG * cosLat),
                lat: hiker[1] - ((dir[1] / n) * BACK_M) / M_PER_DEG,
                alt: hiker[2] + UP_M,
            },
            { lon: hiker[0], lat: hiker[1], alt: hiker[2] },
        );
        cb.onProgress(d, hiker);

        if (d >= length && !paused) finish();
        else raf = requestAnimationFrame(frame);
    };

    const timer = setTimeout(() => (raf = requestAnimationFrame(frame)), APPROACH_S * 1000);

    function finish() {
        if (stopped) return;
        stopped = true;
        clearTimeout(timer);
        cancelAnimationFrame(raf);
        setUserInteractions(api, true);
        lockToIsland(api);
        cb.onEnd();
    }

    return {
        stop: finish,
        seek(distance) {
            d = Math.min(length, Math.max(0, distance));
            // A jump is not a turn: face the new stretch at once.
            dir = heading(points, d);
        },
        setPaused(p) {
            paused = p;
        },
        get paused() {
            return paused;
        },
        setRate(r) {
            rate = r;
        },
    };
}
