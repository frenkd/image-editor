/** Site-wide SEO config and per-page metadata. */

import { FAQ_ITEMS } from "./faq";

export const SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://image-editor-chi-weld.vercel.app";

export const SITE_NAME = "Remove Background";

export type PageSeo = {
  path: string;
  title: string;
  description: string;
  keywords: string[];
};

export const homeSeo: PageSeo = {
  path: "/",
  title: "Remove Image Background Free (Local AI, No Upload)",
  description:
    "Free AI background remover in your browser. Remove image backgrounds locally with no upload. Optional color fill and crop, then download a PNG.",
  keywords: [
    "remove image background",
    "remove background",
    "remove bg",
    "background remover",
    "free background remover",
    "ai background remover",
    "remove photo background",
    "transparent background",
    "cut out image",
    "logo background remover",
    "local background removal",
    "rmbg",
  ],
};

export const howItWorksSeo: PageSeo = {
  path: "/how-it-works",
  title: "How Local Background Removal Works",
  description:
    "Paste an image, download an open Hugging Face model once, cut out the background on your device, then download a PNG.",
  keywords: [
    "how background removal works",
    "local ai background remover",
    "huggingface rmbg",
    "browser background removal",
    "on device image cutout",
    "no upload background remover",
  ],
};

export const faqSeo: PageSeo = {
  path: "/faq",
  title: "Background Remover FAQ",
  description:
    "Answers about local AI background removal: privacy, Hugging Face model download, speed, storage, color, and crop.",
  keywords: [
    "background remover faq",
    "remove background privacy",
    "local background removal",
    "rmbg faq",
  ],
};

export const privacySeo: PageSeo = {
  path: "/privacy",
  title: "Privacy Policy",
  description:
    "How this local background remover handles images, browser storage, model downloads, and analytics.",
  keywords: ["privacy policy", "local background remover privacy"],
};

export const termsSeo: PageSeo = {
  path: "/terms",
  title: "Terms of Use",
  description:
    "Short terms for using this free open-source browser background remover.",
  keywords: ["terms of use", "background remover terms"],
};

export function absoluteUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function webAppJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: SITE_URL,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description: homeSeo.description,
    featureList: [
      "Remove image background locally with AI",
      "Optional color overlay on cutouts",
      "Optional crop after background removal",
    ],
  };
}

export function removeBgFaqJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}

export function softwareAppJsonLd(page: PageSeo): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: page.title,
    url: absoluteUrl(page.path),
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description: page.description,
  };
}
