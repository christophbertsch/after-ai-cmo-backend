import xml2js from 'xml2js';

export async function parsePIESCatalog(xmlContent) {
  const parsed = await xml2js.parseStringPromise(xmlContent, { explicitArray: false });

  let items = parsed?.PIES?.Items?.Item || [];
  items = Array.isArray(items) ? items : [items];

  const products = items.map(item => ({
    ProductID: item.PartNumber || '',
    OriginalDescription: `${item.PartTerminologyID || ''} ${item.Description || ''} ${item.ExtendedInformation || ''}`.trim(),
    Manufacturer: item.BrandLabel || '',
    GTIN: item.ItemLevelGTIN || '',
    HazardousMaterial: item.HazardousMaterialCode || '',
    ExtendedInformation: item.ExtendedInformation || '',
    ProductAttributes: item.ProductAttributes || '',
    PartInterchangeInfo: item.PartInterchangeInfo || '',
    DigitalAssets: item.DigitalAssets || '',
  }));

  return products;
}
