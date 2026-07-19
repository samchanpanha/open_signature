"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { BrandingProvider } from "@/components/branding-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <BrandingProvider>
        {children}
        <Toaster />
      </BrandingProvider>
    </ThemeProvider>
  );
}
