import { createContext, useContext } from "react";
import zhCN from "./locales/zh-CN";
import zhTW from "./locales/zh-TW";
import en from "./locales/en";
import ja from "./locales/ja";
import ko from "./locales/ko";

export type Lang = "zh-CN" | "zh-TW" | "en" | "ja" | "ko";

const translations: Record<Lang, Record<string, string>> = {
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  "en": en,
  "ja": ja,
  "ko": ko,
};

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

export const I18nContext = createContext<I18nContextType>({
  lang: "zh-CN",
  setLang: () => {},
  t: (key: string) => key,
});

export function useI18n() {
  return useContext(I18nContext);
}

export function createI18n(lang: Lang, setLang: (lang: Lang) => void): I18nContextType {
  const t = (key: string, params?: Record<string, string>): string => {
    let text = translations[lang]?.[key] || translations["en"]?.[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, v);
      }
    }
    return text;
  };
  return { lang, setLang, t };
}

export const LANG_OPTIONS: { value: Lang; label: string }[] = [
  { value: "zh-CN", label: "简体中文" },
  { value: "zh-TW", label: "繁體中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
];