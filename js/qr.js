import { routes } from "./routes.js";

const params = new URLSearchParams(window.location.search);

const routeId = params.get("route") || "statyrundan";
const route = routes[routeId] || routes["statyrundan"];

const titleElement = document.querySelector("#qr-route-title");
const countElement = document.querySelector("#qr-artwork-count");
const qrElement = document.querySelector("#qr-code");
const statusElement = document.querySelector("#qr-status");
const backLink = document.querySelector("#back-to-route");

titleElement.textContent = route.title;
countElement.textContent =
  `${route.artworkIds.length} konstverk längs rutten`;

// Länk tillbaka till kartan för samma rutt
backLink.href =
  `ruttoversikt.html?route=${encodeURIComponent(routeId)}`;

// QR-koden ska öppna mobilversionen av den valda rutten
const mobileUrl = new URL("mobil.html", window.location.href);
mobileUrl.searchParams.set("route", routeId);

if (typeof QRCode !== "undefined") {
  new QRCode(qrElement, {
    text: mobileUrl.href,
    width: 250,
    height: 250,
    colorDark: "#282624",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  statusElement.textContent = "";
} else {
  statusElement.textContent =
    "QR-koden kunde inte skapas. Kontrollera internetanslutningen.";
}
