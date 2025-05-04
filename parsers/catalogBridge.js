// catalogBridge.js
const fs = require('fs');
const detectCatalogType = require('./detectCatalogType');
const parseBMEcat = require('./bmecatParser');
const parseBMEcatETIM = require('./bmecatEtimParser');
const parseBMEcat2005 = require('./bmecat2005Parser');
const parsePIES = require('./piesParser');

async function main() {
  const filePath = process.argv[2];
  if (!filePath || !fs.existsSync(filePath)) {
    console.error(JSON.stringify({ error: "Missing or invalid file path" }));
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const type = detectCatalogType(raw);

  let products = [];
  try {
    if (type === 'BMEcat') {
      products = await parseBMEcat(raw);
    } else if (type === 'BMEcatETIM') {
      products = await parseBMEcatETIM(raw);
    } else if (type === 'BMEcat2005') {
      products = await parseBMEcat2005(raw);
    } else if (type === 'PIES') {
      products = await parsePIES(raw);
    } else {
      throw new Error("Unsupported catalog format: " + type);
    }
  } catch (e) {
    console.error(JSON.stringify({ error: e.message || e.toString() }));
    process.exit(1);
  }

  console.log(JSON.stringify({ type, products }));
}

main();
