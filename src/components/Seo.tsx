import { Helmet } from "react-helmet-async";
import { absoluteUrl, SITE_NAME, type PageSeo } from "../lib/seo";

type Props = {
  page: PageSeo;
  /** Extra JSON-LD graphs to embed. */
  jsonLd?: Record<string, unknown>[];
};

export function Seo({ page, jsonLd = [] }: Props) {
  const url = absoluteUrl(page.path);
  const ogImage = absoluteUrl("/og.png");

  return (
    <Helmet>
      <title>{page.title}</title>
      <meta name="description" content={page.description} />
      <meta name="keywords" content={page.keywords.join(", ")} />
      <link rel="canonical" href={url} />
      <meta name="robots" content="index,follow,max-image-preview:large" />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={page.title} />
      <meta property="og:description" content={page.description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:alt" content="Remove image background free" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={page.title} />
      <meta name="twitter:description" content={page.description} />
      <meta name="twitter:image" content={ogImage} />

      {jsonLd.map((graph, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(graph)}
        </script>
      ))}
    </Helmet>
  );
}
