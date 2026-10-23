
(() => {
  // Återställ efter 3 minuters inaktivitet
  const INACTIVITY_LIMIT = 3 * 60 * 1000;

  let inactivityTimer;

  function resetInactivityTimer() {
    clearTimeout(inactivityTimer);

    inactivityTimer = setTimeout(() => {
      window.location.href = "index.html";
    }, INACTIVITY_LIMIT);
  }

  // Händelser som räknas som aktivitet
  const activityEvents = [
    "pointerdown",
    "pointermove",
    "keydown",
    "wheel",
    "touchstart",
    "click",
  ];

  activityEvents.forEach((eventName) => {
    window.addEventListener(
      eventName,
      resetInactivityTimer,
      { passive: true },
    );
  });

  // Starta nedräkningen när sidan öppnas
  resetInactivityTimer();
})();
