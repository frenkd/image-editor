/** Site-wide SEO config and per-page metadata. */

export const SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://image-editor-chi-weld.vercel.app";

export const SITE_NAME = "Remove Background";

export type PageSeo = {
  path: string;
  title: string;
  description: string;
  keywords: string[];
  /** Optional JSON-LD objects (already plain data). */
  jsonLd?: Record<string, unknown>[];
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

/** @deprecated alias of homeSeo for older imports */
export const removeBgSeo = homeSeo;

export const howItWorksSeo: PageSeo = {
  path: "/how-it-works",
  title: "How Local Background Removal Works (Hugging Face Model in Your Browser)",
  description:
    "Plain-language guide to how this free background remover downloads an open Hugging Face model once, then cuts out images on your device with no upload.",
  keywords: [
    "how background removal works",
    "local ai background remover",
    "huggingface rmbg",
    "browser background removal",
    "on device image cutout",
    "no upload background remover",
  ],
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
    mainEntity: [
      {
        "@type": "Question",
        name: "Is this background remover free?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. The remove image background tool is free and open source. Processing runs in your browser on your device.",
        },
      },
      {
        "@type": "Question",
        name: "Do my images get uploaded?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Nothing is uploaded. Background removal runs on-device in your browser; history stays on your computer.",
        },
      },
      {
        "@type": "Question",
        name: "How do I remove a photo or logo background?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Open the remove background tool, drop or paste an image (or paste an image link), wait for the cutout, optionally recolor it, then download a transparent PNG.",
        },
      },
      {
        "@type": "Question",
        name: "Can I make a cutout logo black or white?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. After background removal, use the color overlay controls to fill the cutout black, white, or any custom color while keeping transparency.",
        },
      },
    ],
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
