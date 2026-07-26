export const browserAuthStorageKey = "flash-n-flip.auth.v1";
export const legacyBrowserAuthStorageKey = "flora.auth.v1";

export const hasBrowserSessionHint = (
  storage: Pick<Storage, "getItem">,
): boolean =>
  Boolean(
    storage.getItem(browserAuthStorageKey) ??
    storage.getItem(legacyBrowserAuthStorageKey),
  );

export const homeSessionRedirectScript = `try{if(location.pathname==='/'&&(localStorage.getItem('${browserAuthStorageKey}')||localStorage.getItem('${legacyBrowserAuthStorageKey}')))location.replace('/app')}catch(e){}`;
