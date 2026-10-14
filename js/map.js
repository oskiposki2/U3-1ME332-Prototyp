
import { artworks } from "./artworks.js";
import { routes } from "./routes.js";

// Den publika skärmens ungefärliga position
const screenPosition = [56.87852, 14.80935];

// Hämta vald rutt från URL:en
const params = new URLSearchParams(window.location.search);
const routeId = params.get("route") || "statyrundan";
const route = routes[routeId] || routes["statyrundan"];

// Visa information om rutten
document.querySelector("#route-title").textContent = route.title;
document.querySelector("#route-description").textContent = route.description;

// Hitta konstverken som hör till rutten
const artworkById = new Map(
  artworks.map(artwork => [artwork.id, artwork])
);

const selectedArtworks = route.artworkIds
  .map(id => artworkById.get(id))
  .filter(Boolean);

// Visa antal konstverk
const metaElement = document.querySelector("#route-meta");
const count = document.createElement("span");
count.textContent = `${selectedArtworks.length} konstverk`;
metaElement.replaceChildren(count);

// Skapa kartan
const map = L.map("map");

// Lägg till OpenStreetMap
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// Markera den publika skärmen
L.marker(screenPosition)
  .addTo(map)
  .bindPopup("Publik skärm – start och mål");

// Lägg till numrerade markörer för konstverken
selectedArtworks.forEach((artwork, index) => {
  const icon = L.divIcon({
    className: "artwork-marker-icon",
    html: `<span>${index + 1}</span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });

  L.marker(artwork.coordinates, { icon })
    .addTo(map)
    .bindPopup(`${index + 1}. ${artwork.name}`);
});

// Anpassa kartvyn så att skärmen och konstverken syns
const positions = [
  screenPosition,
  ...selectedArtworks.map(artwork => artwork.coordinates)
];

map.fitBounds(positions, {
  padding: [40, 40]
});
