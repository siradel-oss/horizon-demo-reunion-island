// Curated landmarks of the "Explorer" tab, each with a hand-tuned camera shot.

import type { Viewpoint } from "../engine/scene";
import type { Text } from "../i18n";

export interface Place {
    id: string;
    name: string;
    kind: Text;
    text: Text;
    view: Viewpoint;
}

export const PLACES: Place[] = [
    {
        id: "fournaise",
        name: "Piton de la Fournaise",
        kind: { en: "Active volcano, 2,632 m", fr: "Volcan actif, 2 632 m" },
        text: { en: "One of the most active volcanoes on Earth. The Dolomieu crater opens in the middle of the Enclos, a caldera of bare lava.", fr: "L'un des volcans les plus actifs du monde. Le cratère Dolomieu s'ouvre au milieu de l'Enclos, une caldeira de lave nue." },
        view: { lat: -21.2445, lon: 55.7084, alt: 2450, distance: 7500, bearing: 128, tilt: 62 },
    },
    {
        id: "neiges",
        name: "Piton des Neiges",
        kind: { en: "Roof of the Indian Ocean, 3,070 m", fr: "Toit de l'océan Indien, 3 070 m" },
        text: { en: "The island's highest point, between the three cirques. Hikers climb it at night to watch the sun rise over a sea of clouds.", fr: "Le point culminant de l'île, entre les trois cirques. On y monte de nuit pour voir le soleil se lever sur la mer de nuages." },
        view: { lat: -21.0989, lon: 55.4789, alt: 2900, distance: 11_000, bearing: 15, tilt: 63 },
    },
    {
        id: "mafate",
        name: "Cirque de Mafate",
        kind: { en: "Cirque with no road", fr: "Cirque sans route" },
        text: { en: "No road leads in: its hamlets can only be reached on foot or by helicopter. Seen from the Maïdo, it is a maze of ridges.", fr: "Aucune route n'y entre : les îlets ne se rejoignent qu'à pied ou en hélicoptère. Vu du Maïdo, c'est un labyrinthe de crêtes." },
        view: { lat: -21.045, lon: 55.41, alt: 900, distance: 9500, bearing: 40, tilt: 66 },
    },
    {
        id: "cilaos",
        name: "Cirque de Cilaos",
        kind: { en: "Cirque, road of 400 bends", fr: "Cirque, route aux 400 virages" },
        text: { en: "The sunniest of the cirques, known for its hot springs and lentils, at the foot of the Piton des Neiges.", fr: "Le plus ensoleillé des cirques. Ses sources thermales et ses lentilles poussent au pied du Piton des Neiges." },
        view: { lat: -21.135, lon: 55.47, alt: 1200, distance: 13_000, bearing: 5, tilt: 60 },
    },
    {
        id: "salazie",
        name: "Cirque de Salazie",
        kind: { en: "Cirque, waterfalls", fr: "Cirque, cascades" },
        text: { en: "The greenest and wettest. Dozens of waterfalls drop from the cliffs above the Creole village of Hell-Bourg.", fr: "Le plus vert et le plus arrosé. Des dizaines de cascades tombent des remparts au-dessus du village créole d'Hell-Bourg." },
        view: { lat: -21.065, lon: 55.52, alt: 900, distance: 12_000, bearing: 225, tilt: 60 },
    },
    {
        id: "troudefer",
        name: "Trou de Fer",
        kind: { en: "Chasm, 300 m drop", fr: "Gouffre, 300 m de chute" },
        text: { en: "A canyon where six waterfalls plunge into a gorge so narrow it can only be seen from the sky.", fr: "Un canyon où six cascades se jettent dans une gorge si étroite qu'on ne la découvre que du ciel." },
        view: { lat: -21.083, lon: 55.565, alt: 950, distance: 3800, bearing: 205, tilt: 62 },
    },
    {
        id: "sables",
        name: "Plaine des Sables",
        kind: { en: "Lunar landscape, 2,260 m", fr: "Paysage lunaire, 2 260 m" },
        text: { en: "A treeless desert of red and black scoria on the road to the volcano, under an immense sky.", fr: "Un désert de scories rouges et noires sur la route du volcan, sans un arbre, sous un ciel immense." },
        view: { lat: -21.226, lon: 55.655, alt: 2250, distance: 6500, bearing: 105, tilt: 64 },
    },
    {
        id: "grandbrule",
        name: "Le Grand Brûlé",
        kind: { en: "Lava flows into the ocean", fr: "Coulées sur l'océan" },
        text: { en: "Where lava runs down to the sea. Each eruption adds a few hectares to the island.", fr: "Là où la lave descend jusqu'à la mer. Chaque éruption ajoute quelques hectares à l'île." },
        view: { lat: -21.265, lon: 55.79, alt: 200, distance: 10_000, bearing: 280, tilt: 64 },
    },
    {
        id: "hermitage",
        name: "Lagon de l'Hermitage",
        kind: { en: "Coral reef, west coast", fr: "Récif corallien, côte ouest" },
        text: { en: "A lagoon sheltered by the coral reef, with its casuarina trees and calm waters, below the western slopes.", fr: "Le lagon abrité par la barrière de corail, ses filaos et ses eaux calmes, au pied des pentes de l'ouest." },
        view: { lat: -21.085, lon: 55.235, alt: 0, distance: 6000, bearing: 75, tilt: 66 },
    },
    {
        id: "saintdenis",
        name: "Saint-Denis",
        kind: { en: "Island capital", fr: "Chef-lieu" },
        text: { en: "The city stretches between the sea and the cliffs, from the Barachois to the Creole houses of rue de Paris.", fr: "La ville s'étire entre la mer et les remparts, du Barachois aux cases créoles de la rue de Paris." },
        view: { lat: -20.885, lon: 55.45, alt: 50, distance: 6500, bearing: 190, tilt: 63 },
    },
];
