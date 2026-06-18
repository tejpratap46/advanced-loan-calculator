export const encodeData = (data: any) =>
  btoa(encodeURIComponent(JSON.stringify(data)));

export const decodeData = (hash: string) => {
  try {
    return JSON.parse(decodeURIComponent(atob(hash)));
  } catch {
    return null;
  }
};

export const getShareUrl = (data: any) =>
  `${window.location.origin}${window.location.pathname}#${encodeData(data)}`;
