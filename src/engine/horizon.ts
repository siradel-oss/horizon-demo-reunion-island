// Horizon bootstrap: backend init, message pump, message dispatch.
// Sequence (see Horizon quickstart): init → AsyncApi → pump → ViewerReadyMessage.

import { HrzApi } from "@siradel-oss/horizon-api";
import { HrzCoreBackend, type HrzCoreRuntimeFile } from "@siradel-oss/horizon-core";
import { HrzProtocol } from "@siradel-oss/horizon-protocol";
// Let Vite treat the runtime files as ordinary assets (hashed, copied to dist).
import coreJsUrl from "@siradel-oss/horizon-core/dist/hrz_core.js?url";
import coreWasmUrl from "@siradel-oss/horizon-core/dist/hrz_core.wasm?url";
import { PHONE } from "./device";

export type Api = HrzApi.AsyncApi;
export type EngineMessage = HrzProtocol.TypedMessage.$Properties;

const VIEWER_OPTIONS: HrzProtocol.ViewerOptions.$Properties = {
    showLoadingScreen: false,
    // CTRL + left drag turns and tilts the camera (as in the Horizon gallery).
    keyBindings: { bindings: [{ action: HrzProtocol.KeyAction.MOD_KEY, key: HrzProtocol.Key.K_CTRL }] },
    ...(PHONE
        ? // Phones: engine defaults (320 MiB of tile memory, automatic level), no shadows.
          { graphicsSettingsOverrides: { atmosphereEnabled: true, shadowsEnabled: false } }
        : {
              graphicsLevel: HrzProtocol.GraphicsLevel.GRAPHICS_LEVEL_HIGH,
              graphicsSettingsOverrides: { atmosphereEnabled: true, shadowsEnabled: true },
              // Engine memory for tiles (default 320 MiB): millions of trees plus relief and
              // ortho saturate it in grazing views ("Could not allocate blob").
              blobMemoryPoolSize: 640 * 1024 * 1024,
          }),
};

const PUMP_PERIOD_MS = 40;

type Handler = (message: EngineMessage) => void;
const handlers: Handler[] = [];

/** Subscribe to every message drained from the engine queue. */
export function onEngineMessage(handler: Handler): void {
    handlers.push(handler);
}

/** Initialize the engine on `canvas`; resolves once the viewer accepts commands. */
export async function boot(canvas: HTMLCanvasElement): Promise<Api> {
    const api = await new Promise<Api>((resolve, reject) => {
        HrzCoreBackend.init(
            canvas,
            (file: HrzCoreRuntimeFile) => new URL(file === "hrz_core.wasm" ? coreWasmUrl : coreJsUrl, import.meta.url).href,
            VIEWER_OPTIONS,
            (backend, status) => {
                if (status !== HrzProtocol.ViewerInitStatus.INIT_SUCCESS || !backend) {
                    reject(new Error(`Horizon init failed (status ${status})`));
                    return;
                }
                resolve(new HrzApi.AsyncApi(backend));
            },
        );
    });
    await pumpUntilReady(api);
    fixPointerScale(canvas);
    return api;
}

/**
 * Horizon 26.1 applies the device pixel ratio twice to pointer positions: on a
 * phone (ratio ~2.6) a gesture below the top third of the view falls "outside"
 * it and is ignored (same with a mouse on a HiDPI screen). The engine reads
 * `offsetX/Y` in its `canvas.onpointer*` handlers: hand it CSS pixels divided
 * by the ratio. To remove once the engine is fixed.
 */
function fixPointerScale(canvas: HTMLCanvasElement): void {
    for (const key of ["onpointerdown", "onpointermove", "onpointerup", "onpointercancel"] as const) {
        const handler = canvas[key];
        if (!handler) continue;
        canvas[key] = (event: PointerEvent) =>
            handler.call(
                canvas,
                new Proxy(event, {
                    get(target, prop) {
                        if (prop === "offsetX") return target.offsetX / devicePixelRatio;
                        if (prop === "offsetY") return target.offsetY / devicePixelRatio;
                        const value = Reflect.get(target, prop, target);
                        return typeof value === "function" ? value.bind(target) : value;
                    },
                }),
            );
    }
}

/** Start the (endless) message pump and resolve on ViewerReadyMessage. */
function pumpUntilReady(api: Api): Promise<void> {
    return new Promise((resolve) => {
        let busy = false;
        setInterval(async () => {
            if (busy) return;
            busy = true;
            try {
                const { messages } = await api.MessageQueueService.dequeueMessages({ maxMessageCount: 100 });
                for (const message of messages ?? []) {
                    if (message.viewerReady != null) resolve();
                    for (const handler of handlers) handler(message);
                }
            } finally {
                busy = false;
            }
        }, PUMP_PERIOD_MS);
    });
}
