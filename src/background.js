const DEFAULT_SETTINGS = {
  enabled: true,
  cosmeticFiltering: true,
  youtubeMode: true,
  blockedToday: 0,
  totalBlocked: 0,
  lastResetDate: new Date().toDateString(),
  pausedHosts: []
};
const pausedTabs = new Set();
const pausedRuleIdsByTab = new Map();
const PAUSED_RULE_ID_START = 200000;

async function getSettings() {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

async function setRulesEnabled(enabled) {
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: enabled ? ["core_rules"] : [],
    disableRulesetIds: enabled ? [] : ["core_rules"]
  });
}

async function clearPausedRule(tabId) {
  const ruleId = pausedRuleIdsByTab.get(tabId);

  if (!ruleId) {
    return;
  }

  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [ruleId]
  });
  pausedRuleIdsByTab.delete(tabId);
}

async function setPausedRule(tabId, hostname) {
  const ruleId = PAUSED_RULE_ID_START + tabId;

  await clearPausedRule(tabId);
  await chrome.declarativeNetRequest.updateSessionRules({
    addRules: [
      {
        id: ruleId,
        priority: 100,
        action: { type: "allowAllRequests" },
        condition: {
          requestDomains: [hostname],
          resourceTypes: ["main_frame", "sub_frame"]
        }
      }
    ]
  });
  pausedRuleIdsByTab.set(tabId, ruleId);
}

function normalizeHostname(hostname) {
  return hostname.replace(/^www\./, "").toLowerCase();
}

function getHostnameFromUrl(url) {
  try {
    return normalizeHostname(new URL(url).hostname);
  } catch {
    return "";
  }
}

async function resetDailyStatsIfNeeded(settings) {
  const today = new Date().toDateString();

  if (settings.lastResetDate === today) {
    return settings;
  }

  const nextSettings = {
    ...settings,
    blockedToday: 0,
    lastResetDate: today
  };

  await chrome.storage.local.set(nextSettings);
  return nextSettings;
}

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await getSettings();
  await chrome.storage.local.set(settings);
  await setRulesEnabled(settings.enabled);
});

chrome.runtime.onStartup.addListener(async () => {
  const settings = await resetDailyStatsIfNeeded(await getSettings());
  await setRulesEnabled(settings.enabled);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading") {
    pausedTabs.delete(tabId);
    clearPausedRule(tabId);
    
    const settings = await getSettings();
    const hostname = getHostnameFromUrl(tab?.url ?? "");
    
    if (hostname && settings.pausedHosts.includes(hostname)) {
      setPausedRule(tabId, hostname);
    }
  }
});

chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(async () => {
  const settings = await resetDailyStatsIfNeeded(await getSettings());

  await chrome.storage.local.set({
    blockedToday: settings.blockedToday + 1,
    totalBlocked: settings.totalBlocked + 1
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "getSettings") {
    getSettings()
      .then(resetDailyStatsIfNeeded)
      .then(sendResponse);
    return true;
  }

  if (message.type === "setEnabled") {
    chrome.storage.local
      .set({ enabled: message.enabled })
      .then(() => setRulesEnabled(message.enabled))
      .then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "setCosmeticFiltering") {
    chrome.storage.local
      .set({ cosmeticFiltering: message.enabled })
      .then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "setYoutubeMode") {
    chrome.storage.local
      .set({ youtubeMode: message.enabled })
      .then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "getActiveTabState") {
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(async ([tab]) => {
        const settings = await getSettings();
        const hostname = getHostnameFromUrl(tab?.url ?? "");

        sendResponse({
          hostname,
          isYoutube: hostname === "youtube.com" || hostname.endsWith(".youtube.com") || hostname === "music.youtube.com",
          tabId: tab?.id,
          isPaused: hostname ? settings.pausedHosts.includes(hostname) : false,
          pausedHosts: settings.pausedHosts || []
        });
      });
    return true;
  }

  if (message.type === "setSitePaused") {
    chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      const hostname = getHostnameFromUrl(tab?.url ?? "");

      if (!tab?.id || !hostname) {
        sendResponse({ ok: false });
        return;
      }

      const settings = await getSettings();
      let pausedHosts = settings.pausedHosts || [];

      if (message.paused) {
        pausedTabs.add(tab.id);
        if (!pausedHosts.includes(hostname)) {
          pausedHosts.push(hostname);
        }
        await chrome.storage.local.set({ pausedHosts });
        await setPausedRule(tab.id, hostname);
        sendResponse({ ok: true });
        return;
      }

      pausedTabs.delete(tab.id);
      pausedHosts = pausedHosts.filter(h => h !== hostname);
      await chrome.storage.local.set({ pausedHosts });
      await clearPausedRule(tab.id);
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === "reloadActiveTab") {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) {
        chrome.tabs.reload(tab.id);
      }

      sendResponse({ ok: true });
    });
    return true;
  }

  return false;
});
