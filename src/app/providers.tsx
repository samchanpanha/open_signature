"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { BrandingProvider } from "@/components/branding-provider";
import { I18nProvider } from "@/components/i18n-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
        <BrandingProvider>
          {children}
          <Toaster />
        </BrandingProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
