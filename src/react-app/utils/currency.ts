export const getUserCurrency = (): string => {
  const locale = navigator.language || "en-US";
  const map: { [key: string]: string } = {
    "en-US": "USD",
    "en-GB": "GBP",
    "en-IN": "INR",
    "en-AU": "AUD",
    "en-CA": "CAD",
    "de-DE": "EUR",
    "fr-FR": "EUR",
    "es-ES": "EUR",
    "ja-JP": "JPY",
    "zh-CN": "CNY",
  };
  if (map[locale]) return map[locale];
  const lang = locale.split("-")[0];
  const match = Object.keys(map).find((k) => k.startsWith(lang));
  return match ? map[match] : "USD";
};

export const getCurrencySymbol = (c: string): string => {
  const s: { [k: string]: string } = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    INR: "₹",
    AUD: "A$",
    CAD: "C$",
    CNY: "¥",
  };
  return s[c] || c;
};
