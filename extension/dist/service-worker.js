const d = {
  // Master toggle
  enabled: !0,
  // Typography
  font: "system",
  fontSize: 100,
  // percentage (100 = normal)
  letterSpacing: 0.05,
  // em
  wordSpacing: 0.1,
  // em
  lineHeight: 1.8,
  // Visual themes
  highlightColor: "#4A90D9",
  highContrast: !1,
  darkMode: !1,
  bgColor: "default",
  // Reading aids
  rulerEnabled: !0,
  lineFocusEnabled: !1,
  highlightOnHover: !0,
  paragraphIsolation: !1,
  hideAds: !1,
  // AI
  struggleDetectionEnabled: !0,
  simplificationLevel: 2,
  // default simplification level
  // TTS
  ttsRate: 0.9,
  ttsPitch: 1,
  ttsVoiceURI: null,
  // Privacy
  privacyAIEnabled: !0,
  privacyCameraEnabled: !1,
  privacyLogsEnabled: !0
}, i = "http://localhost:3000/api";
async function c(e, t) {
  return typeof chrome < "u" && chrome.runtime && chrome.runtime.sendMessage ? new Promise((r) => {
    chrome.runtime.sendMessage({ type: e, ...t }, (a) => {
      chrome.runtime.lastError ? r({ error: `Connection failed: ${chrome.runtime.lastError.message}` }) : r(a);
    });
  }) : { error: "Messaging system not available" };
}
async function u(e) {
  if (typeof document < "u")
    return await c("API_SIMPLIFY", { req: e });
  try {
    const t = await fetch(`${i}/simplify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(e)
    });
    if (!t.ok) throw new Error(`API error: ${t.status}`);
    return await t.json();
  } catch (t) {
    return { result: "", error: t.message || "Failed to simplify text" };
  }
}
async function f(e) {
  if (typeof document < "u")
    return await c("API_DEFINE", { req: e });
  try {
    const t = await fetch(`${i}/define`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(e)
    });
    if (!t.ok) throw new Error(`API error: ${t.status}`);
    return await t.json();
  } catch (t) {
    return {
      definition: "",
      pronunciation: "",
      example: "",
      synonyms: [],
      analogy: "",
      is_abbreviation: !1,
      expanded_form: "",
      error: t.message || "Failed to define word"
    };
  }
}
async function g(e) {
  if (typeof document < "u")
    return await c("API_READING_LEVEL", { text: e });
  try {
    const t = await fetch(`${i}/reading-level`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: e })
    });
    if (!t.ok) throw new Error(`API error: ${t.status}`);
    return await t.json();
  } catch (t) {
    return {
      gradeLevel: 0,
      readingEase: 0,
      difficulty: "Unknown",
      color: "gray",
      wordCount: 0,
      sentenceCount: 0,
      avgSyllablesPerWord: 0,
      suggestSimplify: !1,
      error: t.message || "Failed to analyze"
    };
  }
}
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get("acrc_prefs", (e) => {
    e.acrc_prefs || chrome.storage.local.set({ acrc_prefs: d });
  }), chrome.storage.local.get("acrc_progress", (e) => {
    if (!e.acrc_progress) {
      const t = {
        totalSessions: 0,
        totalWordsRead: 0,
        totalTimeMinutes: 0,
        confusedWordsMap: {},
        dailyStats: {},
        streakDays: 0,
        lastActiveDate: ""
      };
      chrome.storage.local.set({ acrc_progress: t });
    }
  }), chrome.storage.local.get("acrc_reading_history", (e) => {
    e.acrc_reading_history || chrome.storage.local.set({ acrc_reading_history: [] });
  }), console.log("[ACRC] Extension installed — defaults initialized");
});
chrome.runtime.onMessage.addListener((e, t, r) => {
  if (e.type === "SESSION_END")
    return y(e.session).then(() => r({ ok: !0 })), !0;
  if (e.type === "CONFUSED_WORD")
    return h(e.word).then(() => r({ ok: !0 })), !0;
  if (e.type === "GET_PROGRESS")
    return chrome.storage.local.get("acrc_progress", (a) => {
      r(a.acrc_progress || {});
    }), !0;
  if (e.type === "GET_HISTORY")
    return chrome.storage.local.get("acrc_reading_history", (a) => {
      r(a.acrc_reading_history || []);
    }), !0;
  if (e.type === "API_SIMPLIFY")
    return u(e.req).then(r), !0;
  if (e.type === "API_DEFINE")
    return f(e.req).then(r), !0;
  if (e.type === "API_READING_LEVEL")
    return g(e.text).then(r), !0;
});
chrome.runtime.onMessageExternal.addListener((e, t, r) => {
  if (e.type === "GET_PROGRESS")
    return chrome.storage.local.get("acrc_progress", (a) => {
      r(a.acrc_progress || {});
    }), !0;
  if (e.type === "GET_HISTORY")
    return chrome.storage.local.get("acrc_reading_history", (a) => {
      r(a.acrc_reading_history || []);
    }), !0;
});
async function y(e) {
  const t = e.endTime ? (e.endTime - e.startTime) / 6e4 : 0, a = (await chrome.storage.local.get("acrc_reading_history")).acrc_reading_history || [];
  a.unshift(e), a.length > 100 && (a.length = 100), await chrome.storage.local.set({ acrc_reading_history: a });
  const o = (await chrome.storage.local.get("acrc_progress")).acrc_progress || {
    totalSessions: 0,
    totalWordsRead: 0,
    totalTimeMinutes: 0,
    confusedWordsMap: {},
    dailyStats: {},
    streakDays: 0,
    lastActiveDate: ""
  };
  o.totalSessions++, o.totalWordsRead += e.wordsRead, o.totalTimeMinutes += t;
  const s = e.date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  if (o.dailyStats[s] || (o.dailyStats[s] = { words: 0, minutes: 0, sessions: 0 }), o.dailyStats[s].words += e.wordsRead, o.dailyStats[s].minutes += t, o.dailyStats[s].sessions++, o.lastActiveDate !== s) {
    const n = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    o.streakDays = o.lastActiveDate === n ? o.streakDays + 1 : 1, o.lastActiveDate = s;
  }
  for (const n of e.confusedWords) {
    const l = n.toLowerCase();
    o.confusedWordsMap[l] = (o.confusedWordsMap[l] || 0) + 1;
  }
  await chrome.storage.local.set({ acrc_progress: o });
}
async function h(e) {
  const r = (await chrome.storage.local.get("acrc_progress")).acrc_progress || {
    totalSessions: 0,
    totalWordsRead: 0,
    totalTimeMinutes: 0,
    confusedWordsMap: {},
    dailyStats: {},
    streakDays: 0,
    lastActiveDate: ""
  }, a = e.toLowerCase();
  r.confusedWordsMap[a] = (r.confusedWordsMap[a] || 0) + 1, await chrome.storage.local.set({ acrc_progress: r });
}
