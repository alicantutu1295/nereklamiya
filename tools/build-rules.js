const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const networkFiltersPath = path.join(projectRoot, "filters", "network.txt");
const cosmeticFiltersPath = path.join(projectRoot, "filters", "cosmetic.txt");
const rulesOutputPath = path.join(projectRoot, "rules", "core-rules.json");
const cosmeticOutputPath = path.join(projectRoot, "src", "generated-cosmetic-rules.js");
const cosmeticCssOutputPath = path.join(projectRoot, "src", "generated-cosmetic-rules.css");

const RESOURCE_TYPES = [
  "sub_frame",
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xmlhttprequest",
  "ping",
  "csp_report",
  "media",
  "websocket",
  "other"
];
const HEURISTIC_REGEX_FILTERS = [
  "^https?://([^/]+\\.)?(ads|advert|analytics|banner|click|metrics|pixel|stat|stats|track|tracker|tracking)[^/]*/",
  "^https?://[^/]+/(.*[/_.-])?(ads|advert|advertisement|adserver|adservice|banner|banners|prebid|sponsor|sponsored|track|tracker|tracking|vast|vpaid)([/_.?&=-]|$)",
  "^https?://[^/]+/.*(300x250|336x280|728x90|160x600|adsbox|adbanner|ad_banner|adframe|adview|adclick|popunder|popupads)",
  "^https?://adblock\\.turtlecute\\.org/.*(ads|advert|analytics|banner|sponsor|track|tracker|pixel|stat)",
  "^https?://([^/]+\\.)?googleads\\.g\\.doubleclick\\.net/(afma|mads|aclk|dbm|pcs|td|caf|pagead)",
  "^https?://([^/]+\\.)?googleadservices\\.com/(afma|mads|aclk|pagead)",
  "^https?://([^/]+\\.)?pagead2\\.googlesyndication\\.com/(pagead|afma|mads|pcs|bg)",
  "^https?://([^/]+\\.)?imasdk\\.googleapis\\.com/(admob|afma|mads)",
  "^https?://([^/]+\\.)?(spotify|spotifycdn|heads-ak|audio-ak|guc-spclient|gew-spclient|spclient\\.wg)\\.(com|net)/.*(ad|ads|advert|advertisement|sponsor|sponsored|promo|promoted|analytics|track|tracker|tracking|pixel|stat|stats)"
];

function readFilterLines(filePath) {
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("!") && !line.startsWith("# "));
}

function parseNetworkFilter(line, id) {
  if (line.startsWith("@@") || line.includes("##") || line.includes("#@#")) {
    return null;
  }

  const [rawPattern, rawOptions = ""] = line.split("$");
  const resourceTypes = rawOptions
    .split(",")
    .map((option) => option.trim())
    .filter((option) => RESOURCE_TYPES.includes(option));

  const pattern = rawPattern.trim();

  if (!pattern) {
    return null;
  }

  const domainMatch = pattern.match(/^\|\|([a-z0-9.-]+)\^?$/i);
  const pathMatch = pattern.match(/^\|\|([a-z0-9.-]+)(\/.+)$/i);
  const condition = {
    resourceTypes: resourceTypes.length ? resourceTypes : RESOURCE_TYPES
  };

  if (pathMatch) {
    condition.urlFilter = `||${pathMatch[1]}${pathMatch[2]}`;
  } else if (domainMatch) {
    condition.requestDomains = [domainMatch[1].toLowerCase()];
  } else {
    condition.urlFilter = pattern;
  }

  return {
    id,
    priority: 1,
    action: { type: "block" },
    condition
  };
}

function parseCosmeticFilter(line) {
  const separatorIndex = line.indexOf("##");

  if (separatorIndex === -1 || line.includes("#@#")) {
    return null;
  }

  return line.slice(separatorIndex + 2).trim() || null;
}

function buildNetworkRules() {
  let nextId = 1;

  const rules = readFilterLines(networkFiltersPath)
    .map((line) => parseNetworkFilter(line, nextId++))
    .filter(Boolean);

  for (const regexFilter of HEURISTIC_REGEX_FILTERS) {
    rules.push({
      id: nextId++,
      priority: 2,
      action: { type: "block" },
      condition: {
        regexFilter,
        resourceTypes: RESOURCE_TYPES
      }
    });
  }

  return rules;
}

function buildCosmeticRules() {
  return [...new Set(readFilterLines(cosmeticFiltersPath).map(parseCosmeticFilter).filter(Boolean))];
}

function writeOutputs() {
  const networkRules = buildNetworkRules();
  const cosmeticRules = buildCosmeticRules();
  const cosmeticCss = cosmeticRules
    .map((selector) => `${selector}{display:none!important;visibility:hidden!important;}`)
    .join("\n");

  fs.writeFileSync(rulesOutputPath, `${JSON.stringify(networkRules, null, 2)}\n`);
  fs.writeFileSync(
    cosmeticOutputPath,
    `globalThis.GENERATED_COSMETIC_SELECTORS = ${JSON.stringify(cosmeticRules, null, 2)};\n`
  );
  fs.writeFileSync(cosmeticCssOutputPath, `${cosmeticCss}\n`);

  console.log(`Built ${networkRules.length} network rules.`);
  console.log(`Built ${cosmeticRules.length} cosmetic selectors.`);
}

writeOutputs();
