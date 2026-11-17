// Generic overlays draped on the terrain: VECTOR_DATA → VECTOR_TILES, fed either
// by a PMTiles file (the app's datasets) or by an IN_MEMORY_VECTOR_SOURCE (the
// few features the app moves around). Every feature carries two numeric
// attributes, exposed to styling scripts as `fid` (index in the app dataset, also
// the pickable feature id) and `kind`.

import { HrzApi } from "@siradel-oss/horizon-api";
import { HrzProtocol } from "@siradel-oss/horizon-protocol";
import type { Api } from "./horizon";
import { MAIN_VIEW } from "./layers";

const ATTR_FID = 1;
const NUMBER = HrzProtocol.AttributeTransform.ATTRIBUTE_TRANSFORM_TO_NUMBER;
const PX = HrzProtocol.InWorldSizeUnit.IN_WORLD_SIZE_IN_PIXELS;
const WGS84 = { descriptorType: HrzProtocol.SrsDescriptorType.SRID_DESCRIPTOR, descriptor: "EPSG:4326" };
const ISLAND = { west: 55.1, south: -21.5, east: 55.95, north: -20.8 };
const ATTR_NAMES = ["fid", "kind"];
// `sourceName` matches the PMTiles properties; in-memory features list values in this order.
const ATTRIBUTES = ATTR_NAMES.map((sourceName, i) => ({ id: ATTR_FID + i, sourceName, isFeatureId: i === 0, transform: NUMBER }));

export type Feature = HrzProtocol.VectorFeature.$Properties;
export type Repr = HrzProtocol.VectorRepr.$Properties;
type ColorProp = HrzProtocol.ColorProperty.$Properties;
type Geometry = HrzProtocol.VectorFeatureGeometry.$Properties;
/** A hovered / picked object, as found in MouseHoverInfo or pick results. */
export type ObjectRef = { layer?: HrzProtocol.LayerHandle.$Properties | null; featureId?: HrzProtocol.FeatureId.$Properties | null } | null | undefined;

export const color = (hex: string, a = 1) => ({
    r: parseInt(hex.slice(1, 3), 16) / 255,
    g: parseInt(hex.slice(3, 5), 16) / 255,
    b: parseInt(hex.slice(5, 7), 16) / 255,
    a,
});

/** Styling snippet setting property "c" from `kind` (one colour per kind). */
export const colorByKind = (colors: string[]) => colors.map((c, i) => `${i ? "elif" : "if"} (attr("kind") == ${i}) { set "c" = ${c}; }`).join(" ");

export const feature = (geometry: Geometry, fid: number, kind: number): Feature => ({
    geometry: [geometry],
    attributeValues: [{ numberValue: fid }, { numberValue: kind }],
});

/** Absolute URL of a file in public/data (the engine resolves URLs on its own). */
export const dataUrl = (file: string) => new URL(`${import.meta.env.BASE_URL}data/${file}`, location.href).href;

export const point = (lon: number, lat: number): Geometry => ({
    type: HrzProtocol.VectorGeometryType.POINT_GEOMETRY,
    coords: [lon, lat, 0],
});

export function line(id: number, width: number, zIndex: number, c: ColorProp, extra: Partial<HrzProtocol.FlatOverlayPolylineVectorRepr.$Properties> = {}): Repr {
    return { id, sceneViews: MAIN_VIEW, flatOverlayPolyline: { color: c, width: { defaultValue: width }, widthUnit: PX, roundTips: true, zIndex, ...extra } };
}

export function dot(id: number, radius: number, zIndex: number, fill: ColorProp, outline: string, outlineWidth: number, outlineAlpha = 1): Repr {
    return {
        id,
        sceneViews: MAIN_VIEW,
        flatOverlayPoint: {
            color: fill,
            radius: { defaultValue: radius },
            radiusUnit: PX,
            outlineColor: { defaultValue: color(outline, outlineAlpha) },
            outlineWidth: { defaultValue: outlineWidth },
            outlineWidthUnit: PX,
            zIndex,
        },
    };
}

/** PMTiles file (tippecanoe layer named after the file), or in-memory features. */
export type OverlaySource = { pmtiles: string; attribution: string } | { features: Feature[] };

export interface Overlay {
    /** In-memory overlays only. */
    setFeatures(features: Feature[]): void;
    setScript(script: string): void;
    setVisible(visible: boolean): void;
    /** `fid` of a hovered / picked feature of this overlay, or -1. */
    indexOf(ref: ObjectRef): number;
}

let nextId = 100;

/** Horizon loading priority (-128…127, default 0): > 0 = requested before the other layers. */
const OVERLAY_LOADING_PRIORITY = 20;

export async function createOverlay(api: Api, name: string, from: OverlaySource, stylingScript: string, representations: Repr[]): Promise<Overlay> {
    const dataId = nextId++;
    const data = await api.LayerService.createLayer({ name: `${name} data`, type: HrzProtocol.LayerType.VECTOR_DATA });
    const tiles = await api.LayerService.createLayer({ name, type: HrzProtocol.LayerType.VECTOR_TILES });
    const tilesPath = () => HrzApi.VectorTilesLayerPathBuilder.create(tiles);
    let setFeatures = (_: Feature[]) => {};

    if ("pmtiles" in from) {
        const layerName = from.pmtiles.replace(/\.pmtiles$/, "");
        await HrzApi.VectorDataLayerPathBuilder.create(data).set(api, {
            id: dataId,
            // A few small tiles: fetched ahead of the hundreds of ortho and relief
            // tiles each camera flight asks for, so the trails show up at once.
            loadingPriority: OVERLAY_LOADING_PRIORITY,
            sources: [{ hasGeometry: true, pmtilesDataProvider: { url: dataUrl(from.pmtiles), layerName, attribution: from.attribution }, attributes: ATTRIBUTES }],
        });
    } else {
        const sourceId = nextId++;
        const source = await api.LayerService.createLayer({ name: `${name} source`, type: HrzProtocol.LayerType.IN_MEMORY_VECTOR_SOURCE });
        // An in-memory source is always rewritten whole (repeated fields have no partial set).
        setFeatures = (f) =>
            void HrzApi.InMemoryVectorSourceLayerPathBuilder.create(source).set(api, { id: sourceId, projection: WGS84, attributes: ATTRIBUTES, features: f });
        setFeatures(from.features);
        await HrzApi.VectorDataLayerPathBuilder.create(data).set(api, {
            id: dataId,
            sources: [{ hasGeometry: true, inMemoryDataProvider: { inMemoryLayerId: sourceId }, attributes: ATTRIBUTES }],
        });
    }
    await tilesPath().set(api, {
        visible: true,
        sceneViews: MAIN_VIEW,
        clipId: -1,
        staticTiles: false,
        source: { vectorDataLayerId: dataId, overrideBounds: true, bounds: ISLAND },
        clamping: { method: HrzProtocol.VectorClampMode.PER_VERTEX },
        resolution: { maxScreenSpaceError: 2 },
        style: {
            attributes: ATTRIBUTES.map((a) => ({ stylingName: a.sourceName, vectorDataAttrId: a.id })),
            stylingScript,
            representations,
        },
    });

    // Hidden = a script that draws nothing, not `visible: false`: a hidden layer
    // loads nothing, so showing it would wait for the network, while this keeps
    // its tiles loaded in the background and shows them at once.
    let script = stylingScript;
    let shown = true;
    const applyScript = () => void tilesPath().style().stylingScript().set(api, shown ? script : "discard;");

    const handle = String(tiles.opaque);
    return {
        setFeatures,
        setScript(next) {
            script = next;
            if (shown) applyScript();
        },
        setVisible(visible) {
            if (visible === shown) return;
            shown = visible;
            applyScript();
        },
        indexOf(ref) {
            if (!ref?.layer || String(ref.layer.opaque) !== handle) return -1;
            const v = ref.featureId?.attributes?.find((a) => a.id === ATTR_FID)?.value?.numberValue;
            return v == null ? -1 : v;
        },
    };
}
