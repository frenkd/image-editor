import { Link } from "react-router-dom";
import { DocShell } from "../components/DocShell";
import { howItWorksSeo } from "../lib/seo";

const STEPS = [
  {
    n: "1",
    title: "Paste or drop",
    body: "Your image is read in this tab only.",
  },
  {
    n: "2",
    title: "Model once",
    body: "RMBG-1.4 downloads from Hugging Face and caches in the browser.",
  },
  {
    n: "3",
    title: "Cutout here",
    body: "The model runs on your device. The photo is not uploaded.",
  },
  {
    n: "4",
    title: "Edit & save",
    body: "Optional color or crop, then download a PNG.",
  },
] as const;

export function HowItWorks() {
  return (
    <DocShell page={howItWorksSeo} title="How it works">
      <p className="doc__lede">
        A free background remover that keeps your image on this device. One open
        model, local cutout, no account.
      </p>

      <ol className="flow-steps">
        {STEPS.map((step) => (
          <li key={step.n} className="flow-steps__item">
            <span className="flow-steps__n" aria-hidden>
              {step.n}
            </span>
            <h2 className="flow-steps__title">{step.title}</h2>
            <p className="flow-steps__body">{step.body}</p>
          </li>
        ))}
      </ol>

      <p className="doc__note">
        Model:{" "}
        <a
          href="https://huggingface.co/briaai/RMBG-1.4"
          target="_blank"
          rel="noreferrer"
        >
          briaai/RMBG-1.4
        </a>
        . Recent cutouts stay in this browser (IndexedDB).
        <br />
        More detail in the <Link to="/faq">FAQ</Link>.
      </p>

      <p className="explain__cta">
        <Link to="/" className="btn btn--primary">
          Try it
        </Link>
      </p>
    </DocShell>
  );
}
