# Reunion Island Explorer

An experimental **3D digital twin of La Réunion** and its hiking trails, in English
and French. Fly over the island's relief, aerial imagery and buildings, browse
places worth seeing, and follow 41 hiking routes with their elevation profile, a
drone flyover, real trees from the IGN LiDAR survey and a sun / shade strip.

> **A demonstrator.** Reunion Island Explorer is a demo of
> [Horizon](https://horizon.oss.siradel.com), Siradel's open source geospatial 3D
> engine, which grew out of the [SCE](https://sce.oss.siradel.com) ecosystem.
> It is still an experiment: the data processing may contain errors, and trail
> times, levels and routes are indicative only. **Do not use it to plan or follow
> a hike**; check trail closures with the
> [ONF](https://www.onf.fr/vivre-la-foret/+/b90::randonnee-la-reunion-connaitre-les-sentiers-fermes.html)
> and the weather before setting off.

## Run it

Requirements: Node.js ≥ 22.12, pnpm ≥ 10, and a browser with WebGL 2 and
`SharedArrayBuffer`.

```bash
pnpm install
pnpm dev        # http://localhost:5173
```

| Command        | Description               |
| -------------- | ------------------------- |
| `pnpm dev`     | Development server        |
| `pnpm build`   | Static build into `dist/` |
| `pnpm preview` | Serves the build locally  |

The build uses relative URLs (Vite base `./`), so `dist/` can be served under
any subpath.

URL parameters, handy for demos:

| Parameter                         | Effect                               |
| --------------------------------- | ------------------------------------ |
| `?lang=en\|fr`                    | interface language                   |
| `?intro=0`                        | skips the opening dive from space    |
| `?ambiance=aube\|midi\|brume\|doree` | starting light (`doree` by default) |

### Serving requirements

Horizon runs its WASM core across threads, which requires `SharedArrayBuffer`.
The static server must therefore send these headers on every response:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

`credentialless` rather than `require-corp`: the IGN tiles do not send a
`Cross-Origin-Resource-Policy` header and would be blocked. The server must also
serve `hrz_core.wasm` as `application/wasm` and accept HTTP `Range` requests
(PMTiles). The dev and preview servers already do all of this (see
`vite.config.ts`).

Hosts that cannot set headers, such as GitHub Pages, rely on the bundled
[coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker) (MIT), which adds
them client-side. The `.github/workflows/deploy.yml` workflow builds and publishes
the app to GitHub Pages on every push to `main`.

## Stack

- [Horizon](https://horizon.oss.siradel.com): `@siradel-oss/horizon-{api,core,protocol}`
- TypeScript and the DOM, no framework; Vite 7
- Fonts bundled from Fontsource (no third-party font requests)

```
src/
├── main.ts           # Wiring: boot, opening flight, tabs, selection, hover
├── i18n.ts           # EN/FR; strings sit next to their component as { en, fr }
├── engine/           # Horizon: layers, scene and camera, overlays, trees, flyover
├── data/             # Catalogues (trails, places, sun), IGN geocoding
└── ui/               # Panels, profile, navigation widget, about dialog
public/data/          # Pre-generated PMTiles and JSON catalogues
public/models/        # Tree models (glTF)
```

## Data

Open data only. The files in `public/data/` were generated from the sources
below; the IGN imagery, elevation and buildings are streamed at runtime.

| Producer           | Datasets                                                                                                                         | Licence                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| IGN, Géoplateforme | BD ORTHO® imagery, RGE ALTI® elevation, BD TOPO® buildings and vegetation, LiDAR HD canopy height, geocoding and altimetry services | [Licence Ouverte 2.0](https://www.etalab.gouv.fr/licence-ouverte-open-licence/) |
| OpenStreetMap      | Hiking routes (`route=hiking` relations) and points of interest                                                                  | [ODbL 1.0](https://www.openstreetmap.org/copyright)                   |
| Wikipedia          | Excerpts of articles describing places (mostly French Wikipedia)                                                                 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)       |

`trails.json`, `trails.pmtiles`, `pois.json` and `pois.pmtiles` contain data
© OpenStreetMap contributors and are a derivative database distributed under the
[Open Database License](https://opendatacommons.org/licenses/odbl/1-0/).
The Wikipedia excerpts in `pois.json` remain under CC BY-SA 4.0; each one links to
its source article in the app.

**Derived information.** Several values are computed by this project and are
neither published nor validated by the data producers:

- trail distance, ascent and high / low points: OpenStreetMap routes resampled and
  draped on RGE ALTI®;
- walking time (DIN 33466) and level: computed from these figures, not from an
  official grading;
- 3D trees (`trees.pmtiles`): tree tops detected in the LiDAR HD canopy height
  model within 150 m of the trails, typed with BD TOPO® vegetation;
- sun / shade strip (`trail-sun.json`): canopy cover and relief horizon along the
  trails, compared in the browser with an approximate sun position.

The same information is available in the in-app **About** dialog.

## License

Code and tree models: [MIT](LICENSE). Data keeps the licence of its producer
(see above). Reunion Island Explorer is not affiliated with the Région Réunion,
Île de La Réunion Tourisme, the ONF, the Parc national de La Réunion or IGN.
Bundled fonts (Bricolage Grotesque, Figtree, through Fontsource) are under the
SIL Open Font License 1.1; their licence files are in `public/licenses/`.

## Contact

Siradel open source: [opensource@siradel.com](mailto:opensource@siradel.com) ·
[www.siradel.com](https://www.siradel.com)
