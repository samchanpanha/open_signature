'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { type Locale, defaultLocale, isValidLocale } from '@/i18n/config';
import enMessages from '@/i18n/messages/en.json';
import kmMessages from '@/i18n/messages/km.json';
import zhMessages from '@/i18n/messages/zh.json';

const messages: Record<Locale, typeof enMessages> = {
  en: enMessages,
  km: kmMessages,
  zh: zhMessages,
};

type Messages = typeof enMessages;

function getNestedValue(obj: Record<string, any>, path: string): string | undefined {
  const keys = path.split('.');
  let current: any = obj;
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    current = current[key];
  }
  return typeof current === 'string' ? current : undefined;
}

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

// Convenience hook for translations
export function useTranslations() {
  const { t } = useI18n();
  return t;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem('opensign-locale');
      if (stored && isValidLocale(stored)) {
        setLocaleState(stored);
      }
    } catch {}
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem('opensign-locale', newLocale);
    } catch {}
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const msgs = messages[locale];
    let value = getNestedValue(msgs as Record<string, any>, key);
    if (value === undefined) {
      // Fallback to English
      value = getNestedValue(enMessages as Record<string, any>, key);
    }
    if (value === undefined) {
      return key;
    }
    if (params) {
      for (const [paramKey, paramValue] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
      }
    }
    return value;
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}
