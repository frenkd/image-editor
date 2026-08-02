import { Link } from "react-router-dom";
import { DocShell } from "../components/DocShell";
import { faqSeo, removeBgFaqJsonLd } from "../lib/seo";

const FAQS = [
  {
    q: "Do images leave my device?",
    a: "No. Processing runs in your browser. We do not receive your photos.",
  },
  {
    q: "What about the Hugging Face download?",
    a: "That request fetches the model weights, not your image. Your photo never goes to Hugging Face as part of this flow.",
  },
  {
    q: "Is it free?",
    a: "Yes. The app is open source, and the cutout runs with the local model in your browser.",
  },
  {
    q: "Why is the first run slow?",
    a: "The model has to download and load once. After that it is cached and much quicker.",
  },
  {
    q: "Where are recent cutouts stored?",
    a: "In this browser only (IndexedDB). Clearing site data removes them. They are not synced to a server.",
  },
  {
    q: "Can I recolor or crop after removal?",
    a: "Yes. After the cutout, use Color or Crop, then download a PNG.",
  },
] as const;

export function Faq() {
  return (
    <DocShell page={faqSeo} title="FAQ" jsonLd={[removeBgFaqJsonLd()]}>
      <dl className="faq-list">
        {FAQS.map((item) => (
          <div key={item.q}>
            <dt>{item.q}</dt>
            <dd>{item.a}</dd>
          </div>
        ))}
      </dl>

      <p className="doc__note">
        Want the short version? See{" "}
        <Link to="/how-it-works">how it works</Link>.
      </p>
    </DocShell>
  );
}
