export const xefjordCollectionTitle = "Xefjord's Complete";

export const xefjordCollectionTemplateKey = "xefjord-complete-collection";

export const xefjordLanguageDeckTitlePattern = /^xefjord['’]s complete\s+.+/i;

export const isXefjordLanguageDeckTitle = (title: string): boolean =>
  xefjordLanguageDeckTitlePattern.test(title.trim());
