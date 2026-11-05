// Geluid Booster – pop-up
const $ = (id) => document.getElementById(id);
const slider = $("slider");
const valueEl = $("value");
const limiterEl = $("limiter");
const hintEl = $("hint");
const errorEl = $("error");

let tabId = null;
let active = false;     // wordt dit tabblad al versterkt?
let busy = Promise.resolve(); // zorgt dat berichten netjes na elkaar gaan

function bg(message) {
  return chrome.runtime.sendMessage({ ...message, target: "background" });
}

function showError(text) {
  errorEl.textContent = text;
  errorEl.hidden = !text;
}

function render(percent) {
  slider.value = percent;
  valueEl.textContent = percent;
  valueEl.parentElement.classList.toggle("normal", percent <= 100);
  hintEl.textContent =
    percent > 100 ? `Dit tabblad klinkt ${(percent / 100).toLocaleString("nl-NL")}× zo hard.` :
    percent < 100 ? "Zachter dan normaal." :
    "Schuif naar rechts voor harder geluid.";
  document.querySelectorAll(".presets button").forEach((b) =>
    b.classList.toggle("active", Number(b.dataset.p) === percent)
  );
}

async function applyNow(percent) {
  const limiter = limiterEl.checked;
  if (!active) {
    if (percent === 100) return; // niets te doen
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
    const res = await bg({ type: "start", tabId, streamId, percent, limiter });
    if (!res || !res.ok) throw new Error(res && res.error);
    active = true;
    return;
  }
  const res = await bg({ type: "set", tabId, percent, limiter });
  if (res && res.ok) return;
  // Sessie was verlopen: opnieuw beginnen.
  active = false;
  return applyNow(percent);
}

function setLevel(percent) {
  render(percent);
  busy = busy
    .then(() => applyNow(percent))
    .then(() => showError(""))
    .catch((err) => {
      const msg = String(err && err.message ? err.message : err);
      if (/active stream/i.test(msg)) {
        showError("Dit tabblad wordt al opgenomen door een andere extensie of een vergadering (bijv. scherm delen). Stop die eerst.");
      } else {
        showError("Dit lukte niet op dit tabblad. Speel eerst iets af op een gewone website (bijv. YouTube) en probeer het opnieuw.");
      }
      console.warn("Geluid Booster:", msg);
    });
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  tabId = tab.id;

  const url = tab.url || "";
  if (/^(chrome|edge|about|chrome-extension|devtools):/i.test(url) || url.startsWith("https://chromewebstore.google.com")) {
    $("main").hidden = true;
    showError("Op deze Chrome-pagina werkt het niet. Ga naar het tabblad waar het geluid vandaan komt (bijv. YouTube) en klik daar op het icoontje.");
    return;
  }

  const state = await bg({ type: "getState", tabId });
  if (state) {
    active = true;
    limiterEl.checked = state.limiter !== false;
    render(state.percent);
  } else {
    render(100);
  }
}

slider.addEventListener("input", () => setLevel(Number(slider.value)));

document.querySelectorAll(".presets button").forEach((b) =>
  b.addEventListener("click", () => setLevel(Number(b.dataset.p)))
);

limiterEl.addEventListener("change", () => {
  if (active) setLevel(Number(slider.value));
});

$("reset").addEventListener("click", () => {
  render(100);
  busy = busy.then(async () => {
    if (active) await bg({ type: "stop", tabId });
    active = false;
    showError("");
  });
});

// Pijltjestoetsen werken op de schuifregelaar; focus er meteen op.
slider.focus();
init();
