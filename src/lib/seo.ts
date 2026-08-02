/** Site-wide SEO config and per-page metadata. */

export const SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://image-editor-chi-weld.vercel.app";

export const SITE_NAME = "Image Editor";

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
  title: "Free Image Editor: Remove Background & Crop Screenshots Locally",
  description:
    "Free local image editor to remove image backgrounds, erase photo backgrounds, and crop screenshots in your browser. No upload, no account. Open-source AI background remover on your laptop.",
  keywords: [
    "image editor",
    "remove background",
    "remove image background",
    "background remover",
    "free background remover",
    "crop screenshot",
    "local image editor",
    "remove bg",
  ],
};

export const removeBgSeo: PageSeo = {
  path: "/remove-background",
  title:
    "Remove Image Background Free: Local AI Background Remover (No Upload)",
  description:
    "Remove image background free in your browser. Local AI background remover for photos, logos, and people. No upload cloud, private on-device cutouts, then recolor black, white, or any color.",
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

export const cropSeo: PageSeo = {
  path: "/crop-image",
  title: "Crop Image & Screenshot Free: Aspect Ratio Crop Tool",
  description:
    "Free online crop tool for images and screenshots. Lock 16:9, 1:1, 4:3, or crop freeform, then download a PNG. Runs locally in your browser.",
  keywords: [
    "crop image",
    "crop screenshot",
    "crop photo",
    "aspect ratio crop",
    "crop 16:9",
    "free crop tool",
    "trim screenshot",
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
      "Recolor cutouts black, white, or custom color",
      "Crop images and screenshots with aspect presets",
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
        name: "Do my images get uploaded to a server?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Background removal runs locally with an on-device AI model. Images stay in your browser; history is stored in IndexedDB on your computer.",
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
