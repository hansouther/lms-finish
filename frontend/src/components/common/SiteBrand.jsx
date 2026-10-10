import { GraduationCap } from "lucide-react";
import { useSite, assetUrl } from "@/lib/site";

const SIZE_ONLY = (cls) => cls.split(/\s+/).filter((c) => /^(h-|w-|rounded|shrink)/.test(c)).join(" ");

export function SiteLogoMark({ className = "", iconClass = "h-5 w-5 text-white" }) {
  const { logo_url, site_name } = useSite();
  if (logo_url) return <img src={assetUrl(logo_url)} alt={site_name} className={`${SIZE_ONLY(className)} object-contain`} data-testid="site-logo-img" />;
  return <div className={`${className} flex items-center justify-center`}><GraduationCap className={iconClass} /></div>;
}

export function SiteName() {
  return <>{useSite().site_name}</>;
}
