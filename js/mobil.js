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
const map = L.map("mobile-map", {
  zoomSnap: 0,
  zoomDelta: 0.25,
}).setView([56.877, 14.811], 14);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
}).addTo(map);


/* GPS – följ besökarens position */

// Hämta GPS-elementen från HTML
const locateButton = document.querySelector("#locate-me");
const locateButtonText = document.querySelector("#locate-button-text");
const locationStatus = document.querySelector("#location-status");

// GPS-tillstånd
let locationWatchId = null;
let isFollowingLocation = false;
let userMarker = null;
let accuracyCircle = null;
let lastUserLatLng = null;
let hasCenteredOnUser = false;

// Uppdatera GPS-knappen
function updateLocationButton() {
  if (isFollowingLocation) {
    locateButtonText.textContent = "Sluta följa min position";
  } else if (locationWatchId !== null) {
    locateButtonText.textContent = "Följ min position igen";
  } else {
    locateButtonText.textContent = "Följ min position";
  }

  locateButton.setAttribute(
    "aria-pressed",
    String(isFollowingLocation),
  );

  locateButton.classList.toggle(
    "is-active",
    isFollowingLocation,
  );
}

// Skapa eller uppdatera den blå positionsmarkören
function updateUserPosition(position) {
  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;
  const accuracy = position.coords.accuracy;
  const latLng = L.latLng(latitude, longitude);

  lastUserLatLng = latLng;

  // Visa en cirkel som anger GPS-positionens ungefärliga noggrannhet
  if (!accuracyCircle) {
    accuracyCircle = L.circle(latLng, {
      radius: accuracy,
      color: "#405fff",
      weight: 1,
      opacity: 0.5,
      fillColor: "#405fff",
      fillOpacity: 0.12,
      interactive: false,
    }).addTo(map);
  } else {
    accuracyCircle.setLatLng(latLng);
    accuracyCircle.setRadius(accuracy);
  }

  // Skapa den blå punkten första gången
  if (!userMarker) {
    const userIcon = L.divIcon({
      className: "mobile-user-icon",
      html: '<span class="mobile-user-dot" aria-hidden="true"></span>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    userMarker = L.marker(latLng, {
      icon: userIcon,
      interactive: false,
      keyboard: false,
      zIndexOffset: 1000,
    }).addTo(map);
  } else {
    userMarker.setLatLng(latLng);
  }

  // Följ användaren endast när följningen är aktiverad
  if (isFollowingLocation) {
    centerOnUser();
  }

  const roundedAccuracy = Math.round(accuracy);

  locationStatus.textContent =
    accuracy > 100
      ? `Din position visas, men GPS-noggrannheten är låg (cirka ${roundedAccuracy} m).`
      : `Din position visas på kartan (noggrannhet cirka ${roundedAccuracy} m).`;
}

// Centrera kartan på användaren
function centerOnUser() {
  if (!lastUserLatLng) return;

  if (!hasCenteredOnUser) {
    map.setView(
      lastUserLatLng,
      Math.max(map.getZoom(), 16),
      { animate: true },
    );

    hasCenteredOnUser = true;
  } else {
    map.panTo(lastUserLatLng, { animate: true });
  }
}

// Avsluta GPS-spårningen och rensa markörerna
function stopLocationFollowing(message = "") {
  if (
    locationWatchId !== null &&
    navigator.geolocation
  ) {
    navigator.geolocation.clearWatch(locationWatchId);
  }

  locationWatchId = null;
  isFollowingLocation = false;
  lastUserLatLng = null;
  hasCenteredOnUser = false;

  if (userMarker) {
    map.removeLayer(userMarker);
    userMarker = null;
  }

  if (accuracyCircle) {
    map.removeLayer(accuracyCircle);
    accuracyCircle = null;
  }

  updateLocationButton();
  locationStatus.textContent = message;
}

// Hantera GPS-fel
function handleLocationError(error) {
  let message;

  switch (error.code) {
    case 1:
      message =
        "Platsåtkomst nekades. Tillåt platsåtkomst i webbläsarens inställningar.";
      break;
    case 2:
      message =
        "Din position kunde inte hittas. Kontrollera mobilens platsinställningar.";
      break;
    case 3:
      message =
        "Det tog för lång tid att hitta din position. Försök igen.";
      break;
    default:
      message = "GPS fungerar inte just nu. Försök igen.";
  }

  stopLocationFollowing(message);
}

// Starta GPS
function startLocationFollowing() {
  if (!navigator.geolocation) {
    locationStatus.textContent =
      "Din webbläsare stöder inte GPS-positionering.";

    return;
  }

  isFollowingLocation = true;
  updateLocationButton();

  locationStatus.textContent = "Hämtar din position…";

  locationWatchId = navigator.geolocation.watchPosition(
    updateUserPosition,
    handleLocationError,
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 20000,
    },
  );

  // Uppdatera knappen när GPS-bevakningen har startat
  updateLocationButton();
}

// Hantera tryck på GPS-knappen
locateButton.addEventListener("click", () => {
  // Om GPS inte är igång: starta positionsföljningen
  if (locationWatchId === null) {
    startLocationFollowing();
    return;
  }

  // Om användaren följs: stäng av GPS-följningen
  if (isFollowingLocation) {
    stopLocationFollowing(
      "Positionsföljningen är avstängd.",
    );
    return;
  }

  // Återuppta följningen efter att användaren flyttat kartan
  isFollowingLocation = true;
  updateLocationButton();

  locationStatus.textContent = "Följer din position.";

  centerOnUser();
});

// Pausa automatisk centrering när användaren drar i kartan.
// GPS-markören fortsätter att uppdateras.
map.on("dragstart", () => {
  if (
    !isFollowingLocation ||
    locationWatchId === null
  ) {
    return;
  }

  isFollowingLocation = false;
  updateLocationButton();

  locationStatus.textContent =
    "Kartföljningen är pausad. Tryck på knappen för att följa din position igen.";
});


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

// Panelens tre lägen
let currentSheetState = "compact";


function keepMarkerVisible(artwork) {
  if (currentSheetState === "expanded") return;

  const mapElement = map.getContainer();
  const mapRect = mapElement.getBoundingClientRect();
  const sheetTop = sheet.getBoundingClientRect().top;

  // Beräkna den synliga kartytan ovanför popupen
  const visibleBottom = Math.min(mapRect.bottom, sheetTop);
  const visibleHeight = visibleBottom - mapRect.top;

  if (visibleHeight < 100) return;

  // Målet är mitten av den synliga kartytan
  const targetX = mapElement.clientWidth / 2;
  const targetY = visibleHeight / 2;

  // Markörens nuvarande position på kartan
  const markerPoint = map.latLngToContainerPoint(
    artwork.coordinates,
  );

  // Beräkna hur mycket kartan behöver flyttas i båda riktningarna
  const shiftX = markerPoint.x - targetX;
  const shiftY = markerPoint.y - targetY;

  // Flytta kartan så att den valda markören hamnar i mitten
  const centerPoint = map
    .project(map.getCenter(), map.getZoom())
    .add([shiftX, shiftY]);

  map.panTo(map.unproject(centerPoint), {
    animate: true,
  });
}


function setSheetState(state) {
  if (!["compact", "medium", "expanded"].includes(state)) {
    return;
  }

  currentSheetState = state;

  sheet.classList.remove(
    "is-expanded",
    "sheet-compact",
    "sheet-medium",
    "sheet-expanded",
  );

  sheet.classList.add(`sheet-${state}`);

  sheet.classList.remove("sheet-drag-show-details");
  sheet.style.height = "";

  const isOpen = state !== "compact";
  const showBackdrop = state === "expanded";

  sheet.setAttribute("aria-expanded", String(isOpen));
  handle.setAttribute("aria-expanded", String(isOpen));

  if (state === "compact") {
    handle.setAttribute("aria-label", "Visa konstverksinformation");
  } else if (state === "medium") {
    handle.setAttribute("aria-label", "Dra upp för mer information");
  } else {
    handle.setAttribute("aria-label", "Dra ned för mindre information");
  }

  backdrop.classList.toggle("is-visible", showBackdrop);
  backdrop.setAttribute("aria-hidden", String(!showBackdrop));

  // Vänta tills panelen har ändrat storlek innan kartan flyttas
  if (state !== "expanded" && routeArtworks.length > 0) {
    window.setTimeout(() => {
      const artwork = routeArtworks[currentIndex];

      if (artwork) {
        keepMarkerVisible(artwork);
      }
    }, 430);
  }
}

routeMeta.textContent = `${routeArtworks.length} konstverk`;

// Popupfunktioner
function openSheet() {
  setSheetState("medium");
}

function closeSheet() {
  setSheetState("compact");
}

// Visa valt konstverk
function selectArtwork(index, moveMap = true, openPopup = true) {
  if (index < 0 || index >= routeArtworks.length) return;

  const sheetWasCompact = currentSheetState === "compact";

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

  // Centrera bara kartan direkt om panelens placering inte styr vyn.
  if (moveMap && !openPopup) {
    map.panTo(artwork.coordinates, { animate: true });
  }

  previousButton.disabled = currentIndex === 0;
  nextButton.disabled = currentIndex === routeArtworks.length - 1;

  // Öppna mellanläget om panelen är kompakt
  if (openPopup && currentSheetState === "compact") {
    setSheetState("medium");
  }

  // Placera markören i rätt läge med en enda kartförflyttning.
  if (openPopup && !sheetWasCompact) {
    if (currentSheetState === "expanded") {
      map.panTo(artwork.coordinates, { animate: true });
    } else {
      keepMarkerVisible(artwork);
    }
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

    map.fitBounds(routeLayer.getBounds().pad(0.12), {
      maxZoom: 15,
      paddingTopLeft: [20, 20],
      paddingBottomRight: [20, 100],
    });

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

// Dra panelen med fingret
let touchStartY = null;
let startPanelHeight = 0;
let startScrollTop = 0;
let isDraggingPanel = false;
let ignorePanelClickUntil = 0;

const compactHeight = 160;

function getPanelHeights() {
  return [
    compactHeight,
    window.innerHeight * 0.55,
    Math.min(window.innerHeight * 0.9, 760),
  ];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function finishPanelDrag() {
  if (!isDraggingPanel) {
    touchStartY = null;
    return;
  }

  const currentHeight = sheet.getBoundingClientRect().height;
  const heights = getPanelHeights();
  const states = ["compact", "medium", "expanded"];

  // Välj det läge vars höjd ligger närmast den aktuella höjden
  let nearestIndex = 0;
  let smallestDifference = Infinity;

  heights.forEach((height, index) => {
    const difference = Math.abs(currentHeight - height);

    if (difference < smallestDifference) {
      smallestDifference = difference;
      nearestIndex = index;
    }
  });

  isDraggingPanel = false;
  touchStartY = null;

  sheet.classList.remove("is-dragging");

  // Förhindra att dragningen råkar aktivera en knapp
  ignorePanelClickUntil = Date.now() + 350;

  setSheetState(states[nearestIndex]);
}

// Börja registrera dragningen
sheet.addEventListener(
  "touchstart",
  (event) => {
    if (event.touches.length !== 1) return;

    // Navigerings- och stängningsknappar ska fungera normalt
    if (
      event.target.closest(
        "#previous-artwork, #next-artwork, #sheet-close, #return-to-map",
      )
    ) {
      return;
    }

    touchStartY = event.touches[0].clientY;
    startPanelHeight = sheet.getBoundingClientRect().height;
    startScrollTop = sheet.querySelector(".sheet-scroll-content").scrollTop;
    isDraggingPanel = false;
  },
  { passive: true },
);

// Låt panelen följa fingret
sheet.addEventListener(
  "touchmove",
  (event) => {
    if (touchStartY === null || event.touches.length !== 1) {
      return;
    }

    const currentY = event.touches[0].clientY;
    const movement = touchStartY - currentY;

    if (Math.abs(movement) < 6 && !isDraggingPanel) {
      return;
    }

    // Avgör om gesten ska dra panelen eller scrolla texten
    if (!isDraggingPanel) {
      const atTopOfContent = startScrollTop <= 1;

      if (currentSheetState === "compact" && movement > 0) {
        isDraggingPanel = true;
      } else if (currentSheetState === "medium" && atTopOfContent) {
        isDraggingPanel = true;
      } else if (
        currentSheetState === "expanded" &&
        movement < 0 &&
        atTopOfContent
      ) {
        isDraggingPanel = true;
      }

      if (isDraggingPanel) {
        sheet.classList.add("is-dragging");
      }
    }

    // Om det är vanlig scrollning låter vi webbläsaren hantera den
    if (!isDraggingPanel) return;

    event.preventDefault();

    const heights = getPanelHeights();
    const maxHeight = heights[2];

    // Fingret uppåt = större panel, nedåt = mindre panel
    const newHeight = clamp(
      startPanelHeight + movement,
      compactHeight,
      maxHeight,
    );

    sheet.style.height = `${newHeight}px`;

    // Visa innehållet när panelen har dragits upp en bit
    sheet.classList.toggle("sheet-drag-show-details", newHeight > 220);
  },
  { passive: false },
);

// Snäpp till närmaste läge när fingret släpps
sheet.addEventListener("touchend", finishPanelDrag);

sheet.addEventListener("touchcancel", finishPanelDrag);

// Hindra oavsiktliga klick precis efter en dragning
sheet.addEventListener(
  "click",
  (event) => {
    if (Date.now() < ignorePanelClickUntil) {
      event.preventDefault();
      event.stopPropagation();
    }
  },
  true,
);

// Handtaget kan fortfarande tryckas på
handle.addEventListener("click", () => {
  if (Date.now() < ignorePanelClickUntil) return;

  if (currentSheetState === "compact") {
    setSheetState("medium");
  } else if (currentSheetState === "medium") {
    setSheetState("expanded");
  } else {
    setSheetState("medium");
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
