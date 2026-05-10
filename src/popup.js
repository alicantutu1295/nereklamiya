const enabledInput = document.querySelector("#enabled");
const youtubeModeInput = document.querySelector("#youtubeMode");
const blockedTodayElement = document.querySelector("#blockedToday");
const totalBlockedElement = document.querySelector("#totalBlocked");
const headlineElement = document.querySelector("#headline");
const activeSiteElement = document.querySelector("#activeSite");
const statusElement = document.querySelector("#status");
const statusDot = document.querySelector("#statusDot");

function formatNumber(value) {
  return new Intl.NumberFormat("tr-TR").format(value ?? 0);
}

function updateStatusDot(enabled) {
  if (enabled) {
    statusDot.style.background = "var(--accent)";
    statusDot.style.animation = "pulse 2s ease-in-out infinite";
    statusDot.querySelector(".material-symbols-outlined").textContent = "check_circle";
  } else {
    statusDot.style.background = "var(--text-secondary)";
    statusDot.style.animation = "none";
    statusDot.querySelector(".material-symbols-outlined").textContent = "cancel";
  }
}

async function loadSettings() {
  const settings = await chrome.runtime.sendMessage({ type: "getSettings" });
  const activeTabState = await chrome.runtime.sendMessage({ type: "getActiveTabState" });

  enabledInput.checked = settings.enabled;
  youtubeModeInput.checked = settings.youtubeMode;
  activeSiteElement.textContent = activeTabState.hostname || "Bu sayfada kullanılamaz";
  headlineElement.textContent = settings.enabled ? "Koruma aktif" : "Koruma kapalı";
  blockedTodayElement.textContent = formatNumber(settings.blockedToday);
  totalBlockedElement.textContent = formatNumber(settings.totalBlocked);
  statusElement.textContent = "Hazır";
  updateStatusDot(settings.enabled);
}

async function reloadActiveTabAndClose() {
  await chrome.runtime.sendMessage({ type: "reloadActiveTab" });
  window.close();
}

async function setEnabled(enabled) {
  statusElement.textContent = "Güncelleniyor...";
  await chrome.runtime.sendMessage({ type: "setEnabled", enabled });
  updateStatusDot(enabled);
  await reloadActiveTabAndClose();
}

async function setYoutubeMode(enabled) {
  statusElement.textContent = "Güncelleniyor...";
  await chrome.runtime.sendMessage({ type: "setYoutubeMode", enabled });
  await loadSettings();
}

enabledInput.addEventListener("change", () => setEnabled(enabledInput.checked));
youtubeModeInput.addEventListener("change", () => setYoutubeMode(youtubeModeInput.checked));

loadSettings();
