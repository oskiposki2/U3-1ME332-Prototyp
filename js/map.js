import { artworks } from "./artworks.js";
import { routes } from "./routes.js";
import { ORS_API_KEY } from "./api.js";



const sheet = document.querySelector("#artwork-sheet");
const closeButton = document.querySelector("#sheet-close");
const backdrop = document.querySelector("#sheet-backdrop");
const takeRouteButton = document.querySelector("#take-route-button");

const sheetTitle = document.querySelector("#sheet-title");
const sheetArtist = document.querySelector("#sheet-artist");
const sheetYear = document.querySelector("#sheet-year");
const sheetDescription = document.querySelector("#sheet-description");

function showArtwork(artwork) {
  sheetTitle.textContent = artwork.title || artwork.name || "Namnlöst konstverk";
  sheetArtist.textContent = "Konstnär: " + artwork.artist;
  sheetYear.textContent = "År: " + artwork.year;
  sheetDescription.textContent = artwork.description;

  sheet.classList.add("is-open");
  backdrop.classList.add("is-open");

  sheet.setAttribute("aria-hidden", "false");
  backdrop.setAttribute("aria-hidden", "false");
}

function closeArtwork() {
  sheet.classList.remove("is-open");
  backdrop.classList.remove("is-open");

  sheet.setAttribute("aria-hidden", "true");
  backdrop.setAttribute("aria-hidden", "true");
}

closeButton.addEventListener("click", closeArtwork);
backdrop.addEventListener("click", closeArtwork);

// Den publika skärmens ungefärliga position
const screenPosition = [56.87852, 14.80935];

// Hämta vald rutt från URL:en
const params = new URLSearchParams(window.location.search);
const routeId = params.get("route") || "statyrundan";
const route = routes[routeId] || routes["statyrundan"];

// Ge rätt URL till QR-sidan
if (takeRouteButton) {
  takeRouteButton.href =
    `qr.html?route=${encodeURIComponent(routeId)}`;
}

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
    className: index === 0 ? "artwork-marker-icon marker-hint" : "artwork-marker-icon",
    html: `<span>${index + 1}</span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });

const marker = L.marker(artwork.coordinates, { icon }).addTo(map);

marker.on("click", () => {
  showArtwork(artwork);
});
});

// Anpassa kartvyn så att skärmen och konstverken syns
const positions = [
  screenPosition,
  ...selectedArtworks.map(artwork => artwork.coordinates)
];


async function drawWalkingRoute() {
  // Start vid skärmen, genom konstverken och tillbaka.
  // Leaflet använder [latitud, longitud].
const waypoints = [
  screenPosition,
  ...selectedArtworks.map(artwork => artwork.coordinates)
];

  // OpenRouteService kräver [longitud, latitud].
  const coordinates = waypoints.map(([lat, lon]) => [lon, lat]);

  try {
    const response = await fetch(
      "https://api.heigit.org/openrouteservice/v2/directions/foot-walking/geojson",
      {
        method: "POST",
        headers: {
          "Authorization": ORS_API_KEY,
          "Content-Type": "application/json",
          "Accept": "application/geo+json, application/json"
        },
        body: JSON.stringify({ coordinates })
      }
    );

    if (!response.ok) {
      throw new Error(`Routingfel: ${response.status} ${await response.text()}`);
    }

    const geojson = await response.json();

    // Rita gångvägen längs det verkliga gångvägsnätet.
    const routeLayer = L.geoJSON(geojson, {
      style: {
        color: "#0e36ff",
        weight: 5,
        opacity: 0.85
      }
    }).addTo(map);

    // Visa hela gångvägen.
    map.fitBounds(routeLayer.getBounds(), {
      padding: [40, 40]
    });

    // Visa faktisk sträcka och beräknad tid om API:t returnerar dem.
    const summary = geojson.features?.[0]?.properties?.summary;

    if (summary && metaElement) {
      const distance = document.createElement("span");
      distance.textContent =
        `${(summary.distance / 1000).toLocaleString("sv-SE", {
          maximumFractionDigits: 1
        })} km`;

      const duration = document.createElement("span");
      duration.textContent =
        `Ca ${Math.round(summary.duration / 60)} min`;

      metaElement.append(distance, duration);
    }
  } catch (error) {
    console.error("Kunde inte beräkna gångrutten:", error);

    // Visa åtminstone alla stopp om routingtjänsten inte fungerar.
    map.fitBounds(waypoints, {
      padding: [40, 40]
    });
  }
}

drawWalkingRoute();

