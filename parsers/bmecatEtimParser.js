import xml2js from 'xml2js';

export async function parseBMEcatETIMCatalog(xmlContent) {
  const parsed = await xml2js.parseStringPromise(xmlContent, { explicitArray: false });

  const articles = parsed?.BMECAT?.T_NEW_CATALOG?.ARTICLE || [];
  const items = Array.isArray(articles) ? articles : [articles];

  const products = items.map(article => {
    const features = article.ARTICLE_FEATURES?.FEATURE || [];

    const featureAttributes = Array.isArray(features)
      ? features.map(f => ({
          FeatureName: f.FNAME || '',
          FeatureValue: f.FVALUE || '',
        }))
      : [{
          FeatureName: features.FNAME || '',
          FeatureValue: features.FVALUE || '',
        }];

    return {
      ProductID: article.SUPPLIER_AID || '',
      OriginalDescription: article.ARTICLE_DETAILS?.DESCRIPTION_SHORT || '',
      Manufacturer: article.ARTICLE_DETAILS?.MANUFACTURER_NAME || '',
      GTIN: article.ARTICLE_DETAILS?.EAN || '',
      HazardousMaterial: '', // BMEcat may not include
      ExtendedInformation: '', // Optional
      ProductAttributes: featureAttributes, // ✨ ETIM Features mapped
      PartInterchangeInfo: article.ARTICLE_REFERENCE || '',
      DigitalAssets: article.ARTICLE_MEDIA || '',
    };
  });

  return products;
}
