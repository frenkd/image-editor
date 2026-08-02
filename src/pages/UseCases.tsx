import { Link } from "react-router-dom";
import { DocShell } from "../components/DocShell";
import {
  absoluteUrl,
  useCasesSeo,
  softwareAppJsonLd,
} from "../lib/seo";

type UseCase = {
  id: string;
  title: string;
  lead: string;
  before: string;
  after: string;
  beforeAlt: string;
  afterAlt: string;
  afterLabel: string;
  body: string;
};

const USE_CASES: UseCase[] = [
  {
    id: "person",
    title: "Cut out a person",
    lead: "Isolate a portrait for profiles, slides, or product pages.",
    before: "/use-cases/person-before.jpg",
    after: "/use-cases/person-after.webp",
    beforeAlt: "Portrait of a person outdoors before background removal",
    afterAlt: "Same person cut out on a transparent checkerboard background",
    afterLabel: "After",
    body: "Paste a photo, remove the background locally, then download a PNG with transparency. Optional crop tightens the frame around the subject.",
  },
  {
    id: "car",
    title: "Cut out a car",
    lead: "Pull a vehicle off the street for listings, decks, or ads.",
    before: "/use-cases/car-before.jpg",
    after: "/use-cases/car-after.webp",
    beforeAlt: "Silver car on a city street before background removal",
    afterAlt: "Same car cut out on a transparent checkerboard background",
    afterLabel: "After",
    body: "Works well for product-style car shots. Keep the full-resolution cutout, then crop if you need a square listing thumbnail.",
  },
  {
    id: "logo",
    title: "Clean and recolor a logo",
    lead: "Strip a busy desk photo, then apply a brand color fill.",
    before: "/use-cases/logo-before.jpg",
    after: "/use-cases/logo-after.webp",
    beforeAlt: "Black logo on a cluttered desk before background removal",
    afterAlt: "Same logo on a transparent background with a teal color overlay",
    afterLabel: "After + color",
    body: "Remove the background first, then recolor the ink (web Color tool, or CLI --color). Handy for marks scanned or photographed on paper.",
  },
];

function useCasesJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: useCasesSeo.title,
    url: absoluteUrl(useCasesSeo.path),
    description: useCasesSeo.description,
    hasPart: USE_CASES.map((item) => ({
      "@type": "CreativeWork",
      name: item.title,
      description: item.lead,
      image: [
        absoluteUrl(item.before),
        absoluteUrl(item.after),
      ],
    })),
  };
}

export function UseCases() {
  return (
    <DocShell
      page={useCasesSeo}
      title="Common use cases"
      jsonLd={[useCasesJsonLd(), softwareAppJsonLd(useCasesSeo)]}
    >
      <p className="doc__lede">
        Free local background removal for everyday cutouts: people, products,
        and logos. Examples below are illustrative before and after pairs.
      </p>

      <div className="use-cases">
        {USE_CASES.map((item) => (
          <section
            key={item.id}
            id={item.id}
            className="use-case"
            aria-labelledby={`use-case-${item.id}`}
          >
            <h2 className="use-case__title" id={`use-case-${item.id}`}>
              {item.title}
            </h2>
            <p className="use-case__lead">{item.lead}</p>

            <div className="use-case__pair">
              <figure className="use-case__shot">
                <figcaption>Before</figcaption>
                <div className="use-case__frame">
                  <img
                    src={item.before}
                    alt={item.beforeAlt}
                    width={1200}
                    height={900}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </figure>
              <figure className="use-case__shot">
                <figcaption>{item.afterLabel}</figcaption>
                <div className="use-case__frame use-case__frame--checker">
                  <img
                    src={item.after}
                    alt={item.afterAlt}
                    width={1200}
                    height={900}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </figure>
            </div>

            <p className="use-case__body">{item.body}</p>
          </section>
        ))}
      </div>

      <p className="doc__note">
        Processing stays in your browser. See{" "}
        <Link to="/how-it-works">how it works</Link> or the{" "}
        <Link to="/faq">FAQ</Link>.
      </p>

      <p className="explain__cta">
        <Link to="/" className="btn btn--primary">
          Try it
        </Link>
      </p>
    </DocShell>
  );
}
