// EN/FR interface. Strings sit next to their component as { en, fr } pairs and
// are resolved once, when the UI is built: switching language reloads the page
// (skipping the opening flight) instead of re-rendering every panel.

export type Lang = "en" | "fr";
export type Text = { en: string; fr: string };

const STORAGE_KEY = "dih-reunion-explorer:lang";

function initialLang(): Lang {
    const fromUrl = new URLSearchParams(location.search).get("lang");
    if (fromUrl === "en" || fromUrl === "fr") return fromUrl;
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === "en" || stored === "fr") return stored;
    } catch {
        // Storage blocked (private mode): fall back to the browser language.
    }
    return navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en";
}

export const LANG: Lang = initialLang();
/** Locale for numbers and sorting. */
export const LOCALE = LANG === "fr" ? "fr-FR" : "en-GB";

document.documentElement.lang = LANG;

/** Resolve a { en, fr } pair in the current language. */
export const t = (s: Text): string => s[LANG];

/** Format a number in the current locale. */
export const num = (n: number, maximumFractionDigits = 0) => n.toLocaleString(LOCALE, { maximumFractionDigits });

/** Persist the choice and reload without the opening flight. */
export function setLang(lang: Lang) {
    if (lang === LANG) return;
    try {
        localStorage.setItem(STORAGE_KEY, lang);
    } catch {
        // Not persisted: the URL parameter still carries it.
    }
    const url = new URL(location.href);
    url.searchParams.set("lang", lang);
    url.searchParams.set("intro", "0");
    location.assign(url);
}
