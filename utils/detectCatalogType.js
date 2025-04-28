import xml2js from 'xml2js';

export async function detectCatalogType(xmlContent) {
  try {
    const parsed = await xml2js.parseStringPromise(xmlContent, { explicitArray: false });

    if (parsed?.PIES) {
      return 'PIES';
    } else if (parsed?.BMECAT) {
      return 'BMEcat';
    } else {
      return 'Unknown';
    }
  } catch (error) {
    console.error('Catalog type detection error:', error);
    return 'Unknown';
  }
}
