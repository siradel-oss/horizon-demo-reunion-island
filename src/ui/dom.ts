// Minimal DOM builder: h("div", { class: "x", onclick }, child, "text").

type Child = Node | string | null | undefined | false;
type Props = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v as EventListener);
        else if (k === "class") node.className = String(v);
        // setProperty, not Object.assign: it also accepts custom properties (--x).
        else if (k === "style" && typeof v === "object") for (const [p, pv] of Object.entries(v as object)) node.style.setProperty(p, String(pv));
        else if (v === true) node.setAttribute(k, "");
        else node.setAttribute(k, String(v));
    }
    for (const c of children) if (c != null && c !== false) node.append(c);
    return node;
}

export const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
