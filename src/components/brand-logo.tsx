"use client";

import { useBranding } from "@/components/branding-provider";
import { FileSignature } from "lucide-react";

export function BrandLogo({ className = "w-8 h-8", textClassName = "font-bold text-lg" }: { className?: string; textClassName?: string }) {
  const { logoUrl, orgName, brandColor } = useBranding();
  return (
    <div className="flex items-center gap-3">
      <div
        className={`${className} gradient-primary rounded-lg flex items-center justify-center shadow-sm overflow-hidden`}
        style={brandColor ? { background: `linear-gradient(135deg, ${brandColor}, color-mix(in srgb, ${brandColor} 60%, #fff 40%))` } : undefined}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={orgName || "logo"} className="w-full h-full object-contain" />
        ) : (
          <FileSignature className="w-5 h-5 text-white" />
        )}
      </div>
      <span className={textClassName} style={brandColor ? { color: brandColor } : undefined}>
        {orgName || "OpenSign"}
      </span>
    </div>
  );
}
