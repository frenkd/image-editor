import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { DocShell } from "../components/DocShell";
import { howItWorksSeo } from "../lib/seo";

const STEPS: {
  n: string;
  title: string;
  body: ReactNode;
}[] = [
  {
    n: "1",
    title: "Paste or drop",
    body: "Your image is read in this tab only.",
  },
  {
    n: "2",
    title: "Download once",
    body: (
      <>
        <a
          href="https://huggingface.co/briaai/RMBG-1.4"
          target="_blank"
          rel="noreferrer"
        >
          RMBG-1.4
        </a>{" "}
        downloads from Hugging Face and caches in the browser.
      </>
    ),
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
];

export function HowItWorks() {
  return (
    <DocShell page={howItWorksSeo} title="How it works">
      <p className="doc__lede">
        A free background remover that keeps your image on this device.
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

      <div className="doc__notes">
        <p className="doc__note">
          Recent cutouts stay in this browser (IndexedDB).
        </p>
        <p className="doc__note">
          More detail in the <Link to="/faq">FAQ</Link>. Examples in{" "}
          <Link to="/use-cases">common use cases</Link>.
        </p>
      </div>

      <p className="explain__cta">
        <Link to="/" className="btn btn--primary">
          Try it
        </Link>
      </p>
    </DocShell>
  );
}
