// Geluid Booster – offscreen-document
// Hier wordt het geluid van het tabblad opgevangen en versterkt weer afgespeeld:
// tabblad → GainNode (versterking) → [limiter] → luidsprekers.

let ctx = null;
const sessions = new Map(); // tabId -> { stream, source, gain, limiter, limiterOn }

function audioContext() {
  if (!ctx) ctx = new AudioContext({ latencyHint: "interactive" });
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function makeLimiter(ac) {
  // Een snelle, harde compressor die pieken afvlakt zodat het niet gaat kraken.
  const c = ac.createDynamicsCompressor();
  c.threshold.value = -6;
  c.knee.value = 6;
  c.ratio.value = 20;
  c.attack.value = 0.002;
  c.release.value = 0.2;
  return c;
}

function route(s) {
  s.gain.disconnect();
  s.limiter.disconnect();
  s.gain.connect(s.meter); // alleen meten, gaat niet naar de luidsprekers
  if (s.limiterOn) {
    s.gain.connect(s.limiter);
    s.limiter.connect(ctx.destination);
  } else {
    s.gain.connect(ctx.destination);
  }
}

function apply(s, percent, limiterOn) {
  const value = Math.max(0, Math.min(600, Number(percent) || 0)) / 100;
  // Zacht overgaan voorkomt klikjes bij het schuiven.
  s.gain.gain.setTargetAtTime(value, ctx.currentTime, 0.02);
  const wantLimiter = limiterOn !== false;
  if (wantLimiter !== s.limiterOn) {
    s.limiterOn = wantLimiter;
    route(s);
  }
}

async function start({ tabId, streamId, percent, limiter }) {
  if (sessions.has(tabId)) {
    apply(sessions.get(tabId), percent, limiter);
    return { ok: true };
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    },
    video: false,
  });
  const ac = audioContext();
  const s = {
    stream,
    source: ac.createMediaStreamSource(stream),
    gain: ac.createGain(),
    limiter: makeLimiter(ac),
    limiterOn: limiter !== false,
    meter: ac.createAnalyser(),
  };
  s.gain.gain.value = Math.max(0, Math.min(600, Number(percent) || 0)) / 100;
  s.source.connect(s.gain);
  route(s);
  sessions.set(tabId, s);

  // Als het tabblad sluit of de opname wegvalt: netjes opruimen.
  for (const track of stream.getAudioTracks()) {
    track.addEventListener("ended", () => {
      stop(tabId);
      chrome.runtime.sendMessage({ target: "background", type: "streamEnded", tabId }).catch(() => {});
    });
  }
  return { ok: true };
}

function stop(tabId) {
  const s = sessions.get(tabId);
  if (!s) return;
  sessions.delete(tabId);
  s.stream.getTracks().forEach((t) => t.stop());
  try { s.source.disconnect(); } catch (_) {}
  try { s.gain.disconnect(); } catch (_) {}
  try { s.limiter.disconnect(); } catch (_) {}
  try { s.meter.disconnect(); } catch (_) {}
  if (sessions.size === 0 && ctx) {
    ctx.close();
    ctx = null;
    // Niets meer te doen: document mag dicht om geheugen te sparen.
    setTimeout(() => { if (sessions.size === 0) window.close(); }, 1000);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.target !== "offscreen") return false;
  (async () => {
    switch (msg.type) {
      case "start":
        return start(msg);
      case "set": {
        const s = sessions.get(msg.tabId);
        if (!s) return { ok: false, error: "niet-actief" };
        apply(s, msg.percent, msg.limiter);
        return { ok: true };
      }
      case "stop":
        stop(msg.tabId);
        return { ok: true };
      case "status": {
        // Voor controle/tests: huidige versterking en geluidsniveau per tabblad.
        const out = {};
        for (const [id, s] of sessions) {
          const buf = new Float32Array(s.meter.fftSize);
          s.meter.getFloatTimeDomainData(buf);
          let peak = 0;
          for (const v of buf) peak = Math.max(peak, Math.abs(v));
          out[id] = { gain: s.gain.gain.value, limiter: s.limiterOn, peak };
        }
        return { ok: true, sessions: out };
      }
    }
    return { ok: false, error: "onbekend bericht" };
  })().then(sendResponse, (err) =>
    sendResponse({ ok: false, error: String(err && err.message ? err.message : err) })
  );
  return true;
});
