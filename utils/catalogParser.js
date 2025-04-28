// utils/catalogParser.js

import xml2js from 'xml2js';

export async function parseCatalog(fileUrl) {
  try {
    const response = await fetch(fileUrl);
    const xml = await response.text();
    const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false });

    let items = parsed?.PIES?.Items?.Item || [];
    if (!Array.isArray(items)) {
      items = [items];
    }
    return items;
  } catch (error) {
    console.error('Error parsing catalog:', error);
    throw new Error('Failed to parse catalog.');
  }
}
