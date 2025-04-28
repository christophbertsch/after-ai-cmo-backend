import xml2js from 'xml2js';

export async function parseBMEcatCatalog(xmlContent) {
  const parsed = await xml2js.parseStringPromise(xmlContent, { explicitArray: false });

  const articles = parsed?.BMECAT?.T_NEW_CATALOG?.ARTICLE || [];
  const items = Array.isArray(articles) ? articles : [articles];

  const products = items.map(article => ({
    ProductID: article.SUPPLIER_AID || '',
    OriginalDescription: article.ARTICLE_DETAILS?.DESCRIPTION_SHORT || '',
    Manufacturer: article.ARTICLE_DETAILS?.MANUFACTURER_NAME || '',
    GTIN: article.ARTICLE_DETAILS?.EAN || '',
    HazardousMaterial: '', // BMEcat might not have this field
    ExtendedInformation: '', // Optional, based on extensions
    ProductAttributes: article.ARTICLE_FEATURES || '',
    PartInterchangeInfo: article.ARTICLE_REFERENCE || '',
    DigitalAssets: article.ARTICLE_MEDIA || '',
  }));

  return products;
}
