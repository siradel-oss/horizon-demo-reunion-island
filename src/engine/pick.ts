// Screen picking (touch screens have no hover): ViewerService.pickScreen queues
// the request and returns a ticket; the result arrives later as a pick message.

import { onEngineMessage, type Api } from "./horizon";
import type { ObjectRef } from "./overlays";

const pending = new Map<string, (refs: ObjectRef[]) => void>();
let listening = false;

/** Objects under a point of the canvas (CSS pixels), nearest first. */
export async function pickAt(api: Api, canvas: HTMLCanvasElement, clientX: number, clientY: number): Promise<ObjectRef[]> {
    if (!listening) {
        listening = true;
        onEngineMessage((m) => {
            const key = String(m.pick?.ticket?.opaque);
            const resolve = pending.get(key);
            if (!m.pick || !resolve) return;
            pending.delete(key);
            resolve((m.pick.results?.results ?? []).filter((r) => r.vector).map((r) => ({ layer: r.layer?.handle, featureId: r.vector?.featureId })));
        });
    }
    // Horizon 26.1 applies the device pixel ratio twice to pick positions, as it
    // does to pointer positions (see fixPointerScale): hand it CSS pixels divided
    // by the ratio, or a tap on a phone picks far below and right of the finger.
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const x = Math.round((clientX - rect.left) / dpr);
    const y = Math.round((clientY - rect.top) / dpr);
    const { hasATicket, ticket } = await api.ViewerService.pickScreen({ coords: { x, y }, includedRasters: [] });
    if (!hasATicket || !ticket) return [];
    return new Promise((resolve) => {
        pending.set(String(ticket.opaque), resolve);
        // Never wait forever on a lost message.
        setTimeout(() => pending.delete(String(ticket.opaque)) && resolve([]), 2000);
    });
}
