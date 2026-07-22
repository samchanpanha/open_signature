'use client';

import { useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
import { locales, localeNames, localeFlags, type Locale } from '@/i18n/config';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10"
        onClick={() => setOpen(!open)}
        aria-label="Change language"
        title={`Language: ${localeNames[locale]}`}
      >
        <Globe className="w-4 h-4" />
      </Button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-1 w-44 bg-popover border rounded-lg shadow-lg z-50 py-1"
            >
              {locales.map((loc) => (
                <button
                  key={loc}
                  onClick={() => { setLocale(loc); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 transition-colors ${
                    locale === loc ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : ''
                  }`}
                >
                  <span className="text-base">{localeFlags[loc]}</span>
                  <span className="flex-1">{localeNames[loc]}</span>
                  {locale === loc && <span className="text-emerald-600 text-xs">✓</span>}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
