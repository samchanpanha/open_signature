'use client';

import { useI18n } from '@/components/i18n-provider';
import { locales, localeNames, localeFlags, type Locale } from '@/i18n/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, Check } from 'lucide-react';

export function SettingsLanguage() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Globe className="w-5 h-5" />
          {t('settings.language')}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t('settings.languageDescription')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {locales.map((loc) => (
          <button
            key={loc}
            onClick={() => setLocale(loc)}
            className={`relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all hover:shadow-md ${
              locale === loc
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-sm'
                : 'border-border hover:border-emerald-300'
            }`}
          >
            {locale === loc && (
              <div className="absolute top-2 right-2">
                <Badge className="bg-emerald-600 text-white">
                  <Check className="w-3 h-3 mr-1" /> Active
                </Badge>
              </div>
            )}
            <span className="text-4xl">{localeFlags[loc]}</span>
            <div className="text-center">
              <p className="font-medium text-lg">{localeNames[loc]}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {loc === 'en' ? 'Default' : loc === 'km' ? 'ភាសាខ្មែរ' : '简体中文'}
              </p>
            </div>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('settings.currentLanguage')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{localeFlags[locale]}</span>
            <div>
              <p className="font-medium">{localeNames[locale]}</p>
              <p className="text-xs text-muted-foreground">Locale: {locale}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
