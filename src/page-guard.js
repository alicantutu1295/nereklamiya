const BLOCK_PATTERNS = [
  /(^|[/?&_.-])(ads|advert|advertisement|adserver|adservice|banner|popunder|popupads|prebid|sponsor|sponsored|vast|vpaid)([/?&_.=-]|$)/i,
  /doubleclick|googlesyndication|googleadservices|scorecardresearch|adnxs|taboola|outbrain|criteo|rubiconproject|pubmatic|openx|moatads|imasdk/i
];
const EXCLUDED_HOSTS = [
  "youtube.com",
  "music.youtube.com",
  "youtu.be",
  "ytimg.com",
  "googlevideo.com",
  "remove.bg",
  "static.remove.bg"
];
const TEST_HOSTS = [
  "adblock.turtlecute.org"
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
      console.log("[page-guard] checkPausedStatus:", { currentHostname, isPaused, pausedHosts: response.pausedHosts });
    } else {
      console.log("[page-guard] chrome.runtime not available");
      isPaused = false;
    }
  } catch (error) {
    console.error("[page-guard] checkPausedStatus error:", error);
    isPaused = false;
  }
}

checkPausedStatus();
console.log("[page-guard] checkPausedStatus called");

const TEST_BLOCK_PATTERNS = [
  /(^|[/?&_.-])(ad|ads|advert|advertisement|adserver|adservice|analytics|banner|click|counter|metrics|pixel|popunder|popupads|prebid|promo|promoted|sponsor|sponsored|stat|stats|track|tracker|tracking|vast|vpaid|300x250|336x280|728x90|970x90|160x600)([/?&_.=-]|$)/i,
  /(adblock|ad_block|ad-banner|adbanner|adbox|adframe|adview|adsbox|adsbygoogle|googleads|pagead|pub_300x250|textads|trackingpixel)/i
];

function isExcludedHost(hostname) {
  return EXCLUDED_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

function isTestHost(hostname) {
  return TEST_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

function shouldBlockUrl(input) {
  return false;
}

function blockedFetchResponse() {
  return new Response("", {
    status: 204,
    statusText: "Blocked by BetterBlock"
  });
}

const originalFetch = window.fetch;

if (typeof originalFetch === "function") {
  window.fetch = function betterBlockFetch(input, init) {
    if (shouldBlockUrl(input)) {
      return Promise.resolve(blockedFetchResponse());
    }

    return originalFetch.apply(this, arguments);
  };
}

const OriginalXMLHttpRequest = window.XMLHttpRequest;

if (typeof OriginalXMLHttpRequest === "function") {
  window.XMLHttpRequest = function BetterBlockXMLHttpRequest() {
    const xhr = new OriginalXMLHttpRequest();
    const originalOpen = xhr.open;
    const originalSend = xhr.send;
    let blocked = false;

    xhr.open = function open(method, url) {
      blocked = shouldBlockUrl(url);
      return originalOpen.apply(xhr, arguments);
    };

    xhr.send = function send() {
      if (blocked) {
        setTimeout(() => {
          xhr.dispatchEvent(new Event("loadend"));
        });
        return undefined;
      }

      return originalSend.apply(xhr, arguments);
    };

    return xhr;
  };
}

const originalSendBeacon = navigator.sendBeacon?.bind(navigator);

if (originalSendBeacon) {
  navigator.sendBeacon = function betterBlockSendBeacon(url, data) {
    if (shouldBlockUrl(url)) {
      return true;
    }

    return originalSendBeacon(url, data);
  };
}

const originalCreateElement = Document.prototype.createElement;

Document.prototype.createElement = function betterBlockCreateElement(tagName, options) {
  const element = originalCreateElement.call(this, tagName, options);
  const normalizedTagName = String(tagName).toLowerCase();

  if (["script", "img", "iframe", "source"].includes(normalizedTagName)) {
    const prototype = normalizedTagName === "script"
      ? HTMLScriptElement.prototype
      : normalizedTagName === "iframe"
        ? HTMLIFrameElement.prototype
        : HTMLImageElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "src");

    if (descriptor?.set && descriptor?.get) {
      Object.defineProperty(element, "src", {
        get() {
          return descriptor.get.call(this);
        },
        set(value) {
          if (shouldBlockUrl(value)) {
            this.dataset.betterBlockBlocked = "true";
            queueMicrotask(() => this.dispatchEvent(new Event("error")));
            return undefined;
          }

          return descriptor.set.call(this, value);
        }
      });
    }
  }

  if (normalizedTagName === "link") {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLLinkElement.prototype, "href");

    if (descriptor?.set && descriptor?.get) {
      Object.defineProperty(element, "href", {
        get() {
          return descriptor.get.call(this);
        },
        set(value) {
          if (shouldBlockUrl(value)) {
            this.dataset.betterBlockBlocked = "true";
            queueMicrotask(() => this.dispatchEvent(new Event("error")));
            return undefined;
          }

          return descriptor.set.call(this, value);
        }
      });
    }
  }

  return element;
};

const originalSetAttribute = Element.prototype.setAttribute;

Element.prototype.setAttribute = function betterBlockSetAttribute(name, value) {
  const attributeName = String(name).toLowerCase();

  if ((attributeName === "src" || attributeName === "href") && shouldBlockUrl(value)) {
    this.dataset.betterBlockBlocked = "true";
    queueMicrotask(() => this.dispatchEvent(new Event("error")));
    return undefined;
  }

  return originalSetAttribute.apply(this, arguments);
};

const OriginalImage = window.Image;

if (typeof OriginalImage === "function") {
  window.Image = function BetterBlockImage(width, height) {
    const image = new OriginalImage(width, height);
    const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");

    if (descriptor?.set && descriptor?.get) {
      Object.defineProperty(image, "src", {
        get() {
          return descriptor.get.call(this);
        },
        set(value) {
          if (shouldBlockUrl(value)) {
            this.dataset.betterBlockBlocked = "true";
            queueMicrotask(() => this.dispatchEvent(new Event("error")));
            return undefined;
          }

          return descriptor.set.call(this, value);
        }
      });
    }

    return image;
  };
}
