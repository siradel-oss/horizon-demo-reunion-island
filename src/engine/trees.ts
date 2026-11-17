// Trees along the hiking trails: real tree tops detected in the IGN LiDAR HD
// canopy height (trees.pmtiles, pre-generated), drawn as
// instanced glTF models. Far trees switch to impostors (pre-rendered sprites).
// The tiles only exist at z15, so trees appear when the camera comes down.
// Hidden by default: a trail sheet switches them on.

import { HrzApi } from "@siradel-oss/horizon-api";
import { HrzProtocol } from "@siradel-oss/horizon-protocol";
import type { Api } from "./horizon";
import { IGN_ATTRIBUTION, MAIN_VIEW } from "./layers";
import { dataUrl } from "./overlays";

const DATA_ID = 2;
const ATTR_STYLE = 1;
const ISLAND = { west: 55.1, south: -21.5, east: 55.95, north: -20.8 };

// Memory budget: every visible z15 tile holds up to ~4k instances, and the
// engine's blob memory is shared with the terrain. Left to the default, an
// oblique view loads ~1 900 tree tiles and starves the relief. So trees are
// refined only near the camera, and skipped altogether from high above.
const TILE_RESOLUTION = 96; // maxScreenSpaceError: higher = refined closer
const MAX_CAMERA_ALTITUDE_M = 3500;

const MODELS = ["tree_round.glb", "tree_oval.glb"];
// The models are ~1 m tall, Y up, facing -Z.
const GLTF_FRAME = { up: HrzProtocol.Axis.POS_Y, front: HrzProtocol.Axis.NEG_Z, handedness: HrzProtocol.Handedness.RIGHT };
const LIGHTING = { enableLighting: true, castShadows: true, receiveShadows: true };

// Each tree carries one attribute `s` = kind·256 + height(m)·8 + shade
// (trees.pmtiles). Kind: 0 broadleaf, 1 conifer (cryptomerias of the
// Hauts), 2 orchard, 3 shrub. Height is the LiDAR height of the top; shade is
// shared by the whole BD TOPO® stand (0–3: hue step, 4–7: lighter). The script
// only adds a light per-tree jitter: ±7 % size, ±3° hue, ±0.03 lightness.
const S = 'attr("s")';
const KIND = `floor(div(${S}, 256))`;
const HEIGHT_M = `mod(floor(div(${S}, 8)), 32)`;
const HUE_STEP = `mul(mod(${S}, 4), 5)`;
const LIGHTER = `mul(floor(div(mod(${S}, 8), 4)), 0.08)`;

/** Tint for a kind: base hue, saturation and lightness, shifted by the stand shade. */
const tint = (hue: number, sat: number, light: number) =>
    `hsl(add(add(${hue}, ${HUE_STEP}), rand_norm_f(0, 3)), ${sat}, add(add(${light}, ${LIGHTER}), rand_norm_f(0, 0.03)))`;

const STYLE = `
    set "rot_z" = rand_unif_f(0, 6.283);
    set "size_x" = mul(${HEIGHT_M}, rand_norm_f(1, 0.07));
    set "size_y" = prp("size_x");
    set "size_z" = prp("size_x");
    if (${KIND} == 1) {
        set "tint" = ${tint(120, 0.22, 0.24)};
        emit 1;
    } elif (${KIND} == 2) {
        set "tint" = ${tint(75, 0.35, 0.5)};
        emit 0;
    } elif (${KIND} == 3) {
        set "tint" = ${tint(65, 0.25, 0.3)};
        emit 0;
    } else {
        set "tint" = ${tint(80, 0.3, 0.3)};
        emit 0;
    }
`;

export interface Trees {
    setVisible(visible: boolean): void;
}

export async function addTrees(api: Api): Promise<Trees> {
    const data = await api.LayerService.createLayer({ name: "Trees data", type: HrzProtocol.LayerType.VECTOR_DATA });
    const tiles = await api.LayerService.createLayer({ name: "Trees", type: HrzProtocol.LayerType.VECTOR_TILES });
    const attributes = [{ id: ATTR_STYLE, sourceName: "s", transform: HrzProtocol.AttributeTransform.ATTRIBUTE_TRANSFORM_TO_NUMBER }];

    await HrzApi.VectorDataLayerPathBuilder.create(data).set(api, {
        id: DATA_ID,
        // Heavy and only a detail: loaded once the relief, ortho and trails are in.
        loadingPriority: -20,
        sources: [{ hasGeometry: true, pmtilesDataProvider: { url: dataUrl("trees.pmtiles"), layerName: "trees", attribution: IGN_ATTRIBUTION }, attributes }],
    });

    await HrzApi.VectorTilesLayerPathBuilder.create(tiles).set(api, {
        visible: true,
        sceneViews: MAIN_VIEW,
        clipId: -1,
        staticTiles: true,
        missingTilePolicy: HrzProtocol.MissingTilePolicy.USE_EMPTY_TILE,
        source: { vectorDataLayerId: DATA_ID, overrideBounds: true, bounds: ISLAND },
        clamping: { method: HrzProtocol.VectorClampMode.PER_VERTEX },
        resolution: { maxScreenSpaceError: TILE_RESOLUTION },
        visibilityConstraints: {
            constraints: [{ altitude: { relativePosition: HrzProtocol.RelativePositionQualifier.BELOW, altitude: MAX_CAMERA_ALTITUDE_M } }],
        },
        lighting: LIGHTING,
        style: {
            attributes: [{ stylingName: "s", vectorDataAttrId: ATTR_STYLE }],
            stylingScript: STYLE,
            representations: MODELS.map((file, id) => ({
                id,
                sceneViews: MAIN_VIEW,
                model: {
                    url: new URL(`${import.meta.env.BASE_URL}models/${file}`, location.href).href,
                    frame: GLTF_FRAME,
                    scale: { name: "size", defaultValue: { x: 12, y: 12, z: 12 } },
                    rotation: { name: "rot", defaultValue: { x: 0, y: 0, z: 0 } },
                    color: { name: "tint", defaultValue: { r: 1, g: 1, b: 1, a: 1 } },
                    featureColorBlendMode: HrzProtocol.BlendMode.BLEND_MULTIPLY,
                    featureColorBlendStrength: 1,
                    lighting: LIGHTING,
                    // Recommended vegetation setup (Horizon docs, "Instanced 3D models").
                    impostorParams: { useImpostor: true, atlasSize: { x: 6, y: 6 }, imageSize: { x: 64, y: 64 }, maxScreenSizePixels: 150 },
                    clipToTile: true,
                },
            })),
        },
    });

    return {
        setVisible: (visible) => void HrzApi.VectorTilesLayerPathBuilder.create(tiles).visible().set(api, visible),
    };
}
