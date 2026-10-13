import { artworks } from "./artworks.js";
import { routes } from "./routes.js";

const screenPosition = [56.87852, 14.80935];

const params = new URLSearchParams(window.location.search);
const routeId = params.get("route") || "statyrundan";
const route = routes[routeId] || routes["statyrundan"];

const titleElement = document.querySelector("#route-title");
const descriptionElement = document.querySelector("#route-description");
const metaElement = document.querySelector("#route-meta");

titleElement.textContent = route.title;
descriptionElement.textContent = route.description;

const artworkById = new Map(
  artworks.map(artwork => [artwork.id, artwork])
);

const selectedArtworks = route.artworkIds
  .map(id => artworkById.get(id))
  .filter(Boolean);

metaElement.replaceChildren();

const count = document.createElement("span");
count.textContent = `${selectedArtworks.length} konstverk`;

const startInfo = document.createElement("span");
startInfo.textContent = "Start och mål vid den publika skärmen";

metaElement.append(count, startInfo);

// Skapa kartan
const map = L.map("map");

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Rita en linje från skärmen via konstverken och tillbaka.
// Detta är raka linjer, inte beräknade gångvägar.
const routeCoordinates = [
  screenPosition,
  ...selectedArtworks.map(artwork => artwork.coordinates),
  screenPosition
];

L.polyline(routeCoordinates, {
  color: "#fd6666",
  weight: 5,
  opacity: 0.8
}).addTo(map);

// Markera den publika skärmen
L.marker(screenPosition)
  .addTo(map)
  .bindPopup("Publik skärm – start och mål");

// Lägg till numrerade konstverksmarkörer
selectedArtworks.forEach((artwork, index) => {
  const icon = L.divIcon({
    className: "artwork-marker-icon",
    html: `<span>${index + 1}</span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });

  const marker = L.marker(artwork.coordinates, { icon }).addTo(map);

  const popup = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = artwork.name;

  popup.append(heading);
  marker.bindPopup(popup);
});

// Visa hela rutten
map.fitBounds(routeCoordinates, {
  padding: [40, 40]
});
