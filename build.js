const fs = require('fs');
const path = require('path');

const networkFiltersPath = path.join(__dirname, 'filters', 'network.txt');
const rulesPath = path.join(__dirname, 'rules', 'core-rules.json');

function parseNetworkFilters() {
  const content = fs.readFileSync(networkFiltersPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('!'));
  const domains = new Set();
  
  for (const line of lines) {
    if (line.startsWith('||') && line.endsWith('^')) {
      const domain = line.slice(2, -1);
      domains.add(domain);
    }
  }
  
  return Array.from(domains);
}

function buildRules() {
  const domains = parseNetworkFilters();
  const rules = [];
  
  domains.forEach((domain, index) => {
    rules.push({
      id: index + 1,
      priority: 1,
      action: {
        type: 'block'
      },
      condition: {
        resourceTypes: [
          'script',
          'xmlhttprequest',
          'sub_frame',
          'ping',
          'csp_report',
          'media',
          'websocket',
          'other'
        ],
        requestDomains: [domain]
      }
    });
  });
  
  fs.writeFileSync(rulesPath, JSON.stringify(rules, null, 2));
  console.log(`Generated ${rules.length} rules for ${domains.length} domains`);
}

buildRules();
