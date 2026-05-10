const COSMETIC_SELECTORS = globalThis.GENERATED_COSMETIC_SELECTORS ?? [];
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"]);
const YOUTUBE_SELECTORS = [
  "ytd-ad-slot-renderer",
  "ytd-companion-slot-renderer",
  "ytd-display-ad-renderer",
  "ytd-promoted-sparkles-web-renderer",
  "ytd-promoted-video-renderer",
  "ytd-action-companion-ad-renderer",
  "ytd-in-feed-ad-layout-renderer",
  "ytd-banner-promo-renderer",
  "ytm-promoted-sparkles-web-renderer",
  ".ytp-ad-module",
  ".ytp-ad-overlay-container",
  ".ytp-ad-player-overlay",
  ".ytp-ad-text",
  ".ytp-ad-preview-container"
];
let isPaused = false;
let currentHostname = "";

function normalizeHostname(hostname) {
  return hostname.replace(/^www\./, "").toLowerCase();
}

async function checkPausedStatus() {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      const response = await chrome.runtime.sendMessage({ type: "getActiveTabState" });
      currentHostname = normalizeHostname(location.hostname);
      isPaused = response.pausedHosts.includes(currentHostname);
      console.log("[content] checkPausedStatus:", { currentHostname, isPaused, pausedHosts: response.pausedHosts });
    } else {
      console.log("[content] chrome.runtime not available");
      isPaused = false;
    }
  } catch (error) {
    console.error("[content] checkPausedStatus error:", error);
    isPaused = false;
  }
}
const BAIT_PATTERNS = [
  "adsbox",
  "adbox",
  "ad-banner",
  "adbanner",
  "ad_banner",
  "advert",
  "advertisement",
  "sponsor",
  "sponsored",
  "google-ad",
  "googleads",
  "text-ad",
  "textads",
  "banner-ad",
  "banner_ads"
];
const TEST_HOSTS = new Set(["adblock.turtlecute.org"]);
const TEST_SELECTORS = [
  "#ad",
  "#ads",
  "#adsbox",
  "#adbox",
  "#advertisement",
  ".ad",
  ".ads",
  ".adsbox",
  ".adbox",
  ".advert",
  ".advertisement",
  ".banner-ad",
  ".banner_ads",
  ".google-ad",
  ".googleads",
  ".text-ad",
  ".textads",
  ".pub_300x250",
  ".pub_300x250m",
  ".pub_728x90",
  ".pub_970x90",
  ".pub_160x600",
  ".ad_300x250",
  ".ad_728x90",
  ".ad_160x600",
  ".ad-leaderboard",
  ".ad-skyscraper",
  ".ad-rectangle",
  ".adblock",
  ".adblocker",
  ".adblock-test",
  ".adsbygoogle",
  "[id*='adbanner']",
  "[id*='adsbox']",
  "[id*='adbox']",
  "[id*='adframe']",
  "[id*='advert']",
  "[id*='sponsor']",
  "[class*='adbanner']",
  "[class*='adsbox']",
  "[class*='adbox']",
  "[class*='adframe']",
  "[class*='advert']",
  "[class*='sponsor']"
];

let observer;

function isYoutubePage() {
  return YOUTUBE_HOSTS.has(location.hostname);
}

function isTestPage() {
  return TEST_HOSTS.has(location.hostname);
}

function hideCosmeticAds() {
  if (isPaused) {
    return;
  }

  const selectors = isYoutubePage()
    ? YOUTUBE_SELECTORS
    : isTestPage()
      ? [...COSMETIC_SELECTORS, ...TEST_SELECTORS]
      : COSMETIC_SELECTORS;

  for (const selector of selectors) {
    for (const element of document.querySelectorAll(selector)) {
      element.style.setProperty("display", "none", "important");
    }
  }

  if (isYoutubePage()) {
    return;
  }

  // BAIT_PATTERNS'i sadece test sitelerinde kullan
  if (isTestPage()) {
    for (const element of document.querySelectorAll("[id], [class]")) {
      const signature = `${element.id} ${element.className}`.toLowerCase();

      if (BAIT_PATTERNS.some((pattern) => signature.includes(pattern))) {
        element.style.setProperty("display", "none", "important");
      }
    }
  }
}

function hardenYoutubePlayer() {
  if (!isYoutubePage()) {
    return;
  }

  const video = document.querySelector("video");

  if (video && document.querySelector(".ad-showing")) {
    video.muted = true;
    video.playbackRate = 16;
    video.currentTime = Math.max(video.currentTime, video.duration || video.currentTime);
  }

  for (const button of document.querySelectorAll(".ytp-ad-skip-button, .ytp-skip-ad-button")) {
    button.click();
  }
}

async function initializeCosmeticFiltering() {
  await checkPausedStatus();
  const settings = await chrome.runtime.sendMessage({ type: "getSettings" });

  observer?.disconnect();

  if (!settings.enabled || !settings.cosmeticFiltering || isPaused) {
    return;
  }

  hideCosmeticAds();

  if (settings.youtubeMode) {
    hardenYoutubePlayer();
  }

  observer = new MutationObserver(() => {
    hideCosmeticAds();

    if (settings.youtubeMode) {
      hardenYoutubePlayer();
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

initializeCosmeticFiltering();

chrome.storage.onChanged.addListener((changes) => {
  console.log("[content] storage.onChanged triggered:", changes);
  
  if (changes.pausedHosts) {
    console.log("[content] pausedHosts changed:", changes.pausedHosts);
    checkPausedStatus().then(() => {
      console.log("[content] checkPausedStatus completed, reinitializing");
      initializeCosmeticFiltering();
    });
    return;
  }

  if (!changes.enabled && !changes.cosmeticFiltering && !changes.youtubeMode) {
    return;
  }

  const enabled = changes.enabled?.newValue;
  const cosmeticFiltering = changes.cosmeticFiltering?.newValue;

  if (enabled === false || cosmeticFiltering === false) {
    observer?.disconnect();
    return;
  }

  if (enabled === true || cosmeticFiltering === true || changes.youtubeMode) {
    initializeCosmeticFiltering();
  }
});
