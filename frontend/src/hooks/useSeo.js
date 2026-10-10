import { useEffect } from "react";
import { useSite, assetUrl } from "@/lib/site";

export const DEFAULT_OG_IMAGE = "https://images.unsplash.com/photo-1543269865-cbf427effbad?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80";

function upsert(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!content) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(url) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", url);
}

export default function useSeo({ title: rawTitle, description: rawDesc, image: rawImage, type = "website" }) {
  const site = useSite();
  const brand = (t) => (t ? t.split("Binara LMS").join(site.site_name) : t);
  const title = brand(rawTitle);
  const description = brand(rawDesc);
  const image = rawImage || assetUrl(site.og_image_url) || assetUrl(site.hero_image_url) || DEFAULT_OG_IMAGE;
  const siteName = site.site_name;
  useEffect(() => {
    const url = window.location.href;
    if (title) document.title = title;
    setCanonical(url);
    upsert("name", "description", description);
    upsert("property", "og:title", title);
    upsert("property", "og:description", description);
    upsert("property", "og:type", type);
    upsert("property", "og:url", url);
    upsert("property", "og:image", image);
    upsert("property", "og:site_name", siteName);
    upsert("name", "twitter:card", image ? "summary_large_image" : "summary");
    upsert("name", "twitter:title", title);
    upsert("name", "twitter:description", description);
    upsert("name", "twitter:image", image);
  }, [title, description, image, type, siteName]);
}
