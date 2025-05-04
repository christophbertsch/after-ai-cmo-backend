// utils/bmecat2005Parser.js
import xml2js from 'xml2js';

export async function parseBMEcat2005Catalog(xmlText) {
  const parsed = await xml2js.parseStringPromise(xmlText, { explicitArray: false });
  const items = parsed?.BMECAT?.T_NEW_CATALOG?.ARTICLE || [];
  return Array.isArray(items) ? items.map(article => ({
    ProductID: article.SUPPLIER_AID || '',
    Manufacturer: article.ARTICLE_DETAILS?.MANUFACTURER_NAME || '',
    Description: article.ARTICLE_DETAILS?.DESCRIPTION_SHORT || '',
    GTIN: article.ARTICLE_ORDER_DETAILS?.ARTICLE_ORDER_REFERENCE || '',
    OptimizedDescription: article.ARTICLE_DETAILS?.DESCRIPTION_SHORT || ''
  })) : [];
}
