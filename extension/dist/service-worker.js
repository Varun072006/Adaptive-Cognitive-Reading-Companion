const d = {
  // Master toggle
  enabled: !0,
  // Typography — always OpenDyslexia
  font: "dyslexic",
  // Reading aids
  highlightOnHover: !0,
  // AI / Struggle detection
  struggleDetectionEnabled: !0,
  simplificationLevel: 2,
  // TTS
  ttsRate: 0.9,
  ttsPitch: 1,
  ttsVoiceURI: null,
  // Privacy
  privacyAIEnabled: !0,
  privacyCameraEnabled: !1,
  privacyLogsEnabled: !0
}, i = "http://localhost:3000/api";
async function c(t, e) {
  return typeof chrome < "u" && chrome.runtime && chrome.runtime.sendMessage ? new Promise((r) => {
    chrome.runtime.sendMessage({ type: t, ...e }, (a) => {
      chrome.runtime.lastError ? r({ error: `Connection failed: ${chrome.runtime.lastError.message}` }) : r(a);
    });
  }) : { error: "Messaging system not available" };
}
async function u(t) {
  if (typeof document < "u")
    return await c("API_SIMPLIFY", { req: t });
  try {
    const e = await fetch(`${i}/simplify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(t)
    });
    if (!e.ok) throw new Error(`API error: ${e.status}`);
    return await e.json();
  } catch (e) {
    return { result: "", error: e.message || "Failed to simplify text" };
  }
}
async function y(t) {
  if (typeof document < "u")
    return await c("API_DEFINE", { req: t });
  try {
    const e = await fetch(`${i}/define`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(t)
    });
    if (!e.ok) throw new Error(`API error: ${e.status}`);
    return await e.json();
  } catch (e) {
    return {
      definition: "",
      pronunciation: "",
      example: "",
      synonyms: [],
      analogy: "",
      is_abbreviation: !1,
      expanded_form: "",
      error: e.message || "Failed to define word"
    };
  }
}
async function f(t) {
  if (typeof document < "u")
    return await c("API_READING_LEVEL", { text: t });
  try {
    const e = await fetch(`${i}/reading-level`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t })
    });
    if (!e.ok) throw new Error(`API error: ${e.status}`);
    return await e.json();
  } catch (e) {
    return {
      gradeLevel: 0,
      readingEase: 0,
      difficulty: "Unknown",
      color: "gray",
      wordCount: 0,
      sentenceCount: 0,
      avgSyllablesPerWord: 0,
      suggestSimplify: !1,
      error: e.message || "Failed to analyze"
    };
  }
}
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ acrc_prefs: d }), chrome.storage.local.get("acrc_progress", (t) => {
    if (!t.acrc_progress) {
      const e = {
        totalSessions: 0,
        totalWordsRead: 0,
        totalTimeMinutes: 0,
        confusedWordsMap: {},
        dailyStats: {},
        streakDays: 0,
        lastActiveDate: ""
      };
      chrome.storage.local.set({ acrc_progress: e });
    }
  }), chrome.storage.local.get("acrc_reading_history", (t) => {
    t.acrc_reading_history || chrome.storage.local.set({ acrc_reading_history: [] });
  }), console.log("[ACRC] Extension installed — defaults initialized");
});
chrome.runtime.onMessage.addListener((t, e, r) => {
  if (t.type === "SESSION_END")
    return g(t.session).then(() => r({ ok: !0 })), !0;
  if (t.type === "CONFUSED_WORD")
    return h(t.word).then(() => r({ ok: !0 })), !0;
  if (t.type === "GET_PROGRESS")
    return chrome.storage.local.get("acrc_progress", (a) => {
      r(a.acrc_progress || {});
    }), !0;
  if (t.type === "GET_HISTORY")
    return chrome.storage.local.get("acrc_reading_history", (a) => {
      r(a.acrc_reading_history || []);
    }), !0;
  if (t.type === "API_SIMPLIFY")
    return u(t.req).then(r), !0;
  if (t.type === "API_DEFINE")
    return y(t.req).then(r), !0;
  if (t.type === "API_READING_LEVEL")
    return f(t.text).then(r), !0;
});
chrome.runtime.onMessageExternal.addListener((t, e, r) => {
  if (t.type === "GET_PROGRESS")
    return chrome.storage.local.get("acrc_progress", (a) => {
      r(a.acrc_progress || {});
    }), !0;
  if (t.type === "GET_HISTORY")
    return chrome.storage.local.get("acrc_reading_history", (a) => {
      r(a.acrc_reading_history || []);
    }), !0;
});
async function g(t) {
  const e = t.endTime ? (t.endTime - t.startTime) / 6e4 : 0, a = (await chrome.storage.local.get("acrc_reading_history")).acrc_reading_history || [];
  a.unshift(t), a.length > 100 && (a.length = 100), await chrome.storage.local.set({ acrc_reading_history: a });
  const o = (await chrome.storage.local.get("acrc_progress")).acrc_progress || {
    totalSessions: 0,
    totalWordsRead: 0,
    totalTimeMinutes: 0,
    confusedWordsMap: {},
    dailyStats: {},
    streakDays: 0,
    lastActiveDate: ""
  };
  o.totalSessions++, o.totalWordsRead += t.wordsRead, o.totalTimeMinutes += e;
  const s = t.date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  if (o.dailyStats[s] || (o.dailyStats[s] = { words: 0, minutes: 0, sessions: 0 }), o.dailyStats[s].words += t.wordsRead, o.dailyStats[s].minutes += e, o.dailyStats[s].sessions++, o.lastActiveDate !== s) {
    const n = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    o.streakDays = o.lastActiveDate === n ? o.streakDays + 1 : 1, o.lastActiveDate = s;
  }
  for (const n of t.confusedWords) {
    const l = n.toLowerCase();
    o.confusedWordsMap[l] = (o.confusedWordsMap[l] || 0) + 1;
  }
  await chrome.storage.local.set({ acrc_progress: o });
}
async function h(t) {
  const r = (await chrome.storage.local.get("acrc_progress")).acrc_progress || {
    totalSessions: 0,
    totalWordsRead: 0,
    totalTimeMinutes: 0,
    confusedWordsMap: {},
    dailyStats: {},
    streakDays: 0,
    lastActiveDate: ""
  }, a = t.toLowerCase();
  r.confusedWordsMap[a] = (r.confusedWordsMap[a] || 0) + 1, await chrome.storage.local.set({ acrc_progress: r });
}
