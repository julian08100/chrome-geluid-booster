// Geluid Booster – achtergrond (service worker)
// Houdt bij welke tabbladen versterkt worden en stuurt het offscreen-document aan,
// waar het geluid echt door een versterker (GainNode) gaat.

const OFFSCREEN_URL = "offscreen.html";

async function getTabs() {
  const { tabs = {} } = await chrome.storage.session.get("tabs");
  return tabs;
}

async function saveTabs(tabs) {
  await chrome.storage.session.set({ tabs });
}

async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
  });
  if (contexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ["USER_MEDIA"],
    justification: "Tabbladgeluid versterken boven 100%",
  });
}

function toOffscreen(message) {
  return chrome.runtime.sendMessage({ ...message, target: "offscreen" });
}

async function updateBadge(tabId, percent) {
  try {
    if (percent && percent !== 100) {
      await chrome.action.setBadgeBackgroundColor({ tabId, color: "#E8542F" });
      await chrome.action.setBadgeText({ tabId, text: String(percent) });
    } else {
      await chrome.action.setBadgeText({ tabId, text: "" });
    }
  } catch (_) {
    // Tabblad bestaat niet meer: niets te doen.
  }
}

async function stopTab(tabId) {
  const tabs = await getTabs();
  if (!tabs[tabId]) return;
  delete tabs[tabId];
  await saveTabs(tabs);
  try {
    await toOffscreen({ type: "stop", tabId });
  } catch (_) {}
  await updateBadge(tabId, 100);
}

async function handle(msg) {
  switch (msg.type) {
    case "getState": {
      const tabs = await getTabs();
      return tabs[msg.tabId] || null;
    }

    case "start": {
      await ensureOffscreen();
      const res = await toOffscreen({
        type: "start",
        tabId: msg.tabId,
        streamId: msg.streamId,
        percent: msg.percent,
        limiter: msg.limiter,
      });
      if (!res || !res.ok) {
        return { ok: false, error: (res && res.error) || "Starten mislukt" };
      }
      const tabs = await getTabs();
      tabs[msg.tabId] = { percent: msg.percent, limiter: msg.limiter };
      await saveTabs(tabs);
      await updateBadge(msg.tabId, msg.percent);
      return { ok: true };
    }

    case "set": {
      const tabs = await getTabs();
      if (!tabs[msg.tabId]) return { ok: false, error: "niet-actief" };
      const res = await toOffscreen({
        type: "set",
        tabId: msg.tabId,
        percent: msg.percent,
        limiter: msg.limiter,
      }).catch(() => null);
      if (!res || !res.ok) {
        // Offscreen-document is weg (bijv. na herstart): status opruimen.
        delete tabs[msg.tabId];
        await saveTabs(tabs);
        return { ok: false, error: "niet-actief" };
      }
      tabs[msg.tabId] = { percent: msg.percent, limiter: msg.limiter };
      await saveTabs(tabs);
      await updateBadge(msg.tabId, msg.percent);
      return { ok: true };
    }

    case "stop": {
      await stopTab(msg.tabId);
      return { ok: true };
    }

    case "streamEnded": {
      // Gemeld door het offscreen-document als de opname vanzelf stopte.
      const tabs = await getTabs();
      delete tabs[msg.tabId];
      await saveTabs(tabs);
      await updateBadge(msg.tabId, 100);
      return { ok: true };
    }
  }
  return null;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.target !== "background") return false;
  handle(msg).then(sendResponse, (err) =>
    sendResponse({ ok: false, error: String(err && err.message ? err.message : err) })
  );
  return true; // asynchroon antwoord
});

chrome.tabs.onRemoved.addListener((tabId) => {
  stopTab(tabId);
});

// Badge opnieuw zetten na navigatie (Chrome wist de badge bij een nieuwe pagina).
chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (info.status !== "complete") return;
  const tabs = await getTabs();
  if (tabs[tabId]) updateBadge(tabId, tabs[tabId].percent);
});
