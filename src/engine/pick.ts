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
    // The engine works in drawing-buffer pixels.
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const x = Math.round((clientX - rect.left) * scale);
    const y = Math.round((clientY - rect.top) * scale);
    const { hasATicket, ticket } = await api.ViewerService.pickScreen({ coords: { x, y }, includedRasters: [] });
    if (!hasATicket || !ticket) return [];
    return new Promise((resolve) => {
        pending.set(String(ticket.opaque), resolve);
        // Never wait forever on a lost message.
        setTimeout(() => pending.delete(String(ticket.opaque)) && resolve([]), 2000);
    });
}
