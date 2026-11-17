// Base "digital twin" layers: IGN orthophoto, RGE ALTI® terrain, BD TOPO® buildings.

import { HrzApi } from "@siradel-oss/horizon-api";
import { HrzProtocol } from "@siradel-oss/horizon-protocol";
import type { Api } from "./horizon";

export const IGN_ATTRIBUTION = "IGN — Géoplateforme";
const GLOBAL_BOUNDS = { west: -180, south: -90, east: 180, north: 90 };
/** Scene-view bitset: a layer (and each representation) with no view bit is never drawn nor loaded. */
export const MAIN_VIEW = { bits: 1 };

// --- Orthophoto --------------------------------------------------------------

export async function addOrthophoto(api: Api): Promise<void> {
    const handle = await api.LayerService.createLayer({ name: "IGN orthophoto", type: HrzProtocol.LayerType.IMAGERY_RASTER });
    await HrzApi.ImageryRasterLayerPathBuilder.create(handle).set(api, {
        visible: true,
        sceneViews: MAIN_VIEW,
        raster: {
            provider: {
                wmts: {
                    url: "https://data.geopf.fr/annexes/ressources/wmts/essentiels.xml",
                    layerIdentifier: "ORTHOIMAGERY.ORTHOPHOTOS",
                    imageFormat: HrzProtocol.ImageFormat.SRGBA_8,
                    attribution: IGN_ATTRIBUTION,
                    // Open sea has no deep tiles: stretch the coarser ones.
                    missingTilePolicy: HrzProtocol.MissingTilePolicy.USE_LOWER_RESOLUTION,
                },
            },
            sampling: {
                filtering: HrzProtocol.TextureFiltering.BILINEAR,
                alphaChannelUsage: HrzProtocol.AlphaChannelUsage.IGNORE_ALPHA_CHANNEL,
                nodataHandling: HrzProtocol.NodataHandling.IGNORE_NODATA,
            },
            blending: { opacity: 1 },
            displayBounds: GLOBAL_BOUNDS,
        },
    });
}

// --- Terrain: RGE ALTI® served as cleaned `client:` tiles ----------------------
//
// RGE ALTI® answers -99999 at sea and 404 on missing
// deep tiles, which tears holes along the coast. Each tile is fetched from IGN,
// negative values are clamped to sea level, then handed to the engine.

const TILE_PX = 256;
const TILE_BYTES = TILE_PX * TILE_PX * 4; // R_F32
const DTM_PATH = "/rge-alti/";
const DTM_MIME = "image/x.raw;width=256;height=256;channels=1;bit_width=32;interleaving=line";

function rgeAltiTileUrl(z: number, x: number, y: number): string {
    return (
        "https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile" +
        "&LAYER=ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES&STYLE=normal" +
        `&TILEMATRIXSET=WGS84G_6_14&TILEMATRIX=${z}&TILECOL=${x}&TILEROW=${y}` +
        "&FORMAT=image/x-bil;bits=32"
    );
}

async function fetchCleanTile(z: number, x: number, y: number): Promise<Uint8Array> {
    try {
        const resp = await fetch(rgeAltiTileUrl(z, x, y));
        if (!resp.ok) return new Uint8Array(TILE_BYTES);
        const buf = await resp.arrayBuffer();
        if (buf.byteLength !== TILE_BYTES) return new Uint8Array(TILE_BYTES);
        const px = new Float32Array(buf);
        // Nodata (-99999) and the negative halo IGN's pyramid smears along the
        // coastline both become sea level.
        for (let i = 0; i < px.length; i++) if (px[i] < 0) px[i] = 0;
        return new Uint8Array(buf);
    } catch {
        return new Uint8Array(TILE_BYTES);
    }
}

/** Answer `client:/rge-alti/{z}/{x}/{y}` asset requests; ignore anything else. */
export function serveTerrainAsset(api: Api, req: HrzProtocol.AssetRequestMessage.$Properties | null | undefined): void {
    const url = req?.url ?? "";
    const at = url.indexOf(DTM_PATH);
    if (!req || at < 0) return;
    const [z, x, y] = url.slice(at + DTM_PATH.length).split("/").map((s) => parseInt(s, 10));
    void fetchCleanTile(z, x, y).then((tile) => {
        const start = Number(req.rangeStart ?? 0);
        const size = Number(req.rangeSize ?? 0);
        return api.ClientDataService.provideAssetData({
            ticket: req.ticket,
            data: size > 0 ? tile.subarray(start, start + size) : tile,
        });
    });
}

export async function addTerrain(api: Api): Promise<void> {
    const handle = await api.LayerService.createLayer({ name: "RGE ALTI", type: HrzProtocol.LayerType.DTM_RASTER });
    await HrzApi.DtmRasterLayerPathBuilder.create(handle).set(api, {
        visible: true,
        raster: {
            sampling: {
                nodataHandling: HrzProtocol.NodataHandling.IGNORE_NODATA,
                filtering: HrzProtocol.TextureFiltering.BILINEAR,
            },
            displayBounds: GLOBAL_BOUNDS,
            provider: {
                tiled: {
                    urlPattern: `client:${DTM_PATH}{z}/{x}/{y}`,
                    imageFormat: HrzProtocol.ImageFormat.R_F32,
                    mimeTypeOverride: DTM_MIME,
                    attribution: IGN_ATTRIBUTION,
                    geometry: {
                        projection: {
                            descriptorType: HrzProtocol.SrsDescriptorType.SRID_DESCRIPTOR,
                            descriptor: "EPSG:4326",
                        },
                    },
                    // EPSG:4326 grid, 2×1 at level 0 = IGN's WGS84G matrix set,
                    // so Horizon (z, x, y) = IGN (TILEMATRIX, TILECOL, TILEROW).
                    tilingScheme: {
                        globalTiling: { tileSize: TILE_PX, levelZeroTileCountX: 2, levelZeroTileCountY: 1, maxLevel: 14 },
                    },
                },
            },
        },
    });
}

// --- Buildings ---------------------------------------------------------------

const BUILDINGS_DATA_ID = 1;

/** BD TOPO® footprints (PLAN.IGN vector tiles) extruded by `hauteur`, in pastel "case créole" tones. */
export async function addBuildings(api: Api): Promise<void> {
    const data = await api.LayerService.createLayer({ name: "Buildings data", type: HrzProtocol.LayerType.VECTOR_DATA });
    const tiles = await api.LayerService.createLayer({ name: "Buildings", type: HrzProtocol.LayerType.VECTOR_TILES });
    const lighting = { enableLighting: true, castShadows: true, receiveShadows: true };

    await HrzApi.VectorDataLayerPathBuilder.create(data).set(api, {
        id: BUILDINGS_DATA_ID,
        sources: [
            {
                hasGeometry: true,
                tilejsonDataProvider: {
                    url: "https://data.geopf.fr/tms/1.0.0/PLAN.IGN/metadata.json/",
                    layerName: "bati_surf",
                    attribution: IGN_ATTRIBUTION,
                    httpHeaders: {},
                },
                attributes: [{ sourceName: "hauteur", transform: HrzProtocol.AttributeTransform.ATTRIBUTE_TRANSFORM_TO_NUMBER }],
            },
        ],
    });

    await HrzApi.VectorTilesLayerPathBuilder.create(tiles).set(api, {
        visible: true,
        sceneViews: MAIN_VIEW,
        clipId: -1,
        staticTiles: true,
        source: { vectorDataLayerId: BUILDINGS_DATA_ID, bounds: GLOBAL_BOUNDS },
        clamping: { method: HrzProtocol.VectorClampMode.PER_VERTEX },
        resolution: { maxScreenSpaceError: 2 },
        lighting,
        style: {
            attributes: [{ stylingName: "hauteur" }],
            stylingScript: `
                if (attr("hauteur") < 0.1) { discard; }
                set "extrusion" = attr("hauteur");
                set "wall" = hsl(rand_unif_f(15, 190), 0.38, 0.84);
                set "base" = darken(prp("wall"), 0.22);
                set "roof" = mix_colors(#a5483a, #9aa0a4, rand_unif_f(0, 1));
                emit 0;
            `,
            representations: [
                {
                    id: 0,
                    sceneViews: MAIN_VIEW,
                    extrudedGeometry: {
                        lighting,
                        extrusion: { name: "extrusion" },
                        upperColor: { name: "wall", defaultValue: { r: 0.95, g: 0.92, b: 0.85, a: 1 } },
                        lowerColor: { name: "base", defaultValue: { r: 0.7, g: 0.68, b: 0.62, a: 1 } },
                        roofColor: { name: "roof", defaultValue: { r: 0.65, g: 0.3, b: 0.25, a: 1 } },
                        clipToTile: true,
                    },
                },
            ],
        },
    });
}
