import { artworks } from "./artworks.js";
import { routes } from "./routes.js";
import { ORS_API_KEY } from "./api.js";

// Hämta vald rutt från URL:en
const params = new URLSearchParams(window.location.search);
const requestedRouteId = params.get("route");

const routeId =
  requestedRouteId && routes[requestedRouteId]
    ? requestedRouteId
    : "statyrundan";

const route = routes[routeId];

// Hämta HTML-element
const routeTitle = document.querySelector("#route-title");
const routeMeta = document.querySelector("#route-meta");
const artworkPosition = document.querySelector("#artwork-position");
const previewPosition = document.querySelector("#preview-position");
const previewTitle = document.querySelector("#preview-title");
const artworkTitle = document.querySelector("#artwork-title");
const artworkMeta = document.querySelector("#artwork-meta");
const artworkDescription = document.querySelector("#artwork-description");
const locateButton = document.querySelector("#locate-me");
const locateButtonText = document.querySelector("#locate-button-text");
const locationStatus = document.querySelector("#location-status");

const sheet = document.querySelector("#artwork-sheet");
const backdrop = document.querySelector("#sheet-backdrop");
const handle = document.querySelector("#sheet-handle");

const previousButton = document.querySelector("#previous-artwork");
const nextButton = document.querySelector("#next-artwork");

// Visa rutten
routeTitle.textContent = route.title;

// Hitta konstverk med ID
const artworkById = new Map(artworks.map((artwork) => [artwork.id, artwork]));

// Behåll stöd för äldre objekt som använder "name"
function getArtworkInfo(artwork) {
  let title = artwork.title || artwork.name || "Konstverk";
  let artist = artwork.artist || "";
  let year = artwork.year || "";

  if (!artwork.title && artwork.name) {
    const match = artwork.name.match(/^(.*?)\s*\((\d{4})\)\s*(.*)$/);

    if (match) {
      title = match[1].trim() || title;
      year = year || match[2];
      artist = artist || match[3].trim();
    }
  }

  return {
    id: artwork.id,
    title,
    artist,
    year,
    description:
      artwork.description ||
      "Det finns ingen ytterligare information om konstverket.",
    coordinates: artwork.coordinates,
  };
}

// Hämta konstverk i ruttens ordning
const routeArtworks = route.artworkIds
  .map((id) => artworkById.get(id))
  .filter(
    (artwork) =>
      artwork &&
      Array.isArray(artwork.coordinates) &&
      artwork.coordinates.length === 2,
  )
  .map(getArtworkInfo);

// Skapa karta
const map = L.map("mobile-map").setView([56.877, 14.811], 14);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
}).addTo(map);

// Markörer
let currentIndex = 0;
const markers = [];

function createMarkerIcon(number, isActive) {
  return L.divIcon({
    className: "mobile-div-icon",
    html: `
      <span class="mobile-map-marker ${isActive ? "is-active" : ""}">
        ${number}
      </span>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
}

routeMeta.textContent = `${routeArtworks.length} konstverk`;

// Popupfunktioner
function openSheet() {
  sheet.classList.add("is-expanded");
  backdrop.classList.add("is-visible");

  sheet.setAttribute("aria-expanded", "true");
  handle.setAttribute("aria-expanded", "true");
  handle.setAttribute("aria-label", "Stäng konstverksinformationen");
  backdrop.setAttribute("aria-hidden", "false");
}

function closeSheet() {
  sheet.classList.remove("is-expanded");
  backdrop.classList.remove("is-visible");

  sheet.setAttribute("aria-expanded", "false");
  handle.setAttribute("aria-expanded", "false");
  handle.setAttribute("aria-label", "Visa konstverksinformation");
  backdrop.setAttribute("aria-hidden", "true");
}

// Visa valt konstverk
function selectArtwork(index, moveMap = true, openPopup = true) {
  if (index < 0 || index >= routeArtworks.length) return;

  currentIndex = index;

  const artwork = routeArtworks[currentIndex];

  artworkTitle.textContent = artwork.title;
  previewTitle.textContent = `${currentIndex + 1}. ${artwork.title}`;

  artworkMeta.textContent = [artwork.artist, artwork.year]
    .filter(Boolean)
    .join(" · ");

  artworkDescription.textContent = artwork.description;

  const position = `${currentIndex + 1} av ${routeArtworks.length}`;
  artworkPosition.textContent = position;
  previewPosition.textContent = position;

  // Uppdatera markörernas utseende
  markers.forEach((marker, markerIndex) => {
    marker.setIcon(
      createMarkerIcon(markerIndex + 1, markerIndex === currentIndex),
    );
  });

  // Flytta kartan när man går till föregående/nästa
  if (moveMap) {
    map.panTo(artwork.coordinates, { animate: true });
  }

  previousButton.disabled = currentIndex === 0;
  nextButton.disabled = currentIndex === routeArtworks.length - 1;

  if (openPopup) {
    openSheet();
  }
}

// Lägg till markörer på kartan
routeArtworks.forEach((artwork, index) => {
  const marker = L.marker(artwork.coordinates, {
    icon: createMarkerIcon(index + 1, index === 0),
  }).addTo(map);

  marker.on("click", () => {
    selectArtwork(index, false, true);
  });

  markers.push(marker);
});

// Anpassa kartan efter konstverken
if (markers.length > 1) {
  const markerGroup = L.featureGroup(markers);

  map.fitBounds(markerGroup.getBounds().pad(0.15), {
    maxZoom: 15,
  });
} else if (markers.length === 1) {
  map.setView(routeArtworks[0].coordinates, 16);
}

// Rita gångrutten via HeiGIT
async function drawWalkingRoute() {
  if (routeArtworks.length < 2) return;

  const coordinates = routeArtworks.map((artwork) => [
    artwork.coordinates[1],
    artwork.coordinates[0],
  ]);

  try {
    const response = await fetch(
      "https://api.heigit.org/openrouteservice/v2/directions/foot-hiking/geojson",
      {
        method: "POST",
        headers: {
          Authorization: ORS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ coordinates }),
      },
    );

    if (!response.ok) {
      throw new Error(`API-fel ${response.status}`);
    }

    const geojson = await response.json();

    if (!geojson.features || !geojson.features.length) {
      throw new Error("API:et returnerade ingen gångrutt.");
    }

    const routeLayer = L.geoJSON(geojson, {
      style: {
        color: "#0e36ff",
        weight: 5,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
      },
    }).addTo(map);

    map.fitBounds(routeLayer.getBounds().pad(0.12));

    const summary = geojson.features[0].properties?.summary;

    if (summary) {
      const distance = (summary.distance / 1000).toLocaleString("sv-SE", {
        maximumFractionDigits: 1,
      });

      routeMeta.textContent = `${routeArtworks.length} konstverk · ${distance} km`;
    }
  } catch (error) {
    console.error("Kunde inte rita gångrutten:", error);
  }
}

// Öppna och stäng popupen
document.querySelector("#sheet-open").addEventListener("click", openSheet);

handle.addEventListener("click", () => {
  if (sheet.classList.contains("is-expanded")) {
    closeSheet();
  } else {
    openSheet();
  }
});

document.querySelector("#sheet-close").addEventListener("click", closeSheet);
document.querySelector("#return-to-map")?.addEventListener("click", closeSheet);
backdrop.addEventListener("click", closeSheet);

// Navigera mellan konstverken
previousButton.addEventListener("click", () => {
  selectArtwork(currentIndex - 1);
});

nextButton.addEventListener("click", () => {
  selectArtwork(currentIndex + 1);
});

// Visa första konstverket utan att öppna popupen automatiskt
if (routeArtworks.length > 0) {
  selectArtwork(0, false, false);
} else {
  previewTitle.textContent = "Inga konstverk hittades";
  artworkTitle.textContent = "Rutten saknar konstverk";
  artworkMeta.textContent = "";
  artworkDescription.textContent =
    "Kontrollera konstverkens ID:n och koordinater i routes.js och artworks.js.";

  previousButton.disabled = true;
  nextButton.disabled = true;
}

// Starta ruttberäkningen
drawWalkingRoute();