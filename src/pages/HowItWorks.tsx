import { Link } from "react-router-dom";
import { Seo } from "../components/Seo";
import { SiteFooter } from "../components/SiteFooter";
import { howItWorksSeo, removeBgFaqJsonLd } from "../lib/seo";

export function HowItWorks() {
  return (
    <div className="studio explain">
      <Seo page={howItWorksSeo} jsonLd={[removeBgFaqJsonLd()]} />

      <header className="studio__header">
        <div>
          <p className="explain__back">
            <Link to="/">← Remove background</Link>
          </p>
          <h1 className="studio__title">How it works</h1>
        </div>
      </header>

      <article className="explain__body">
        <section>
          <h2>In short</h2>
          <p>
            Your image stays in this browser tab. A small AI model is downloaded
            once from Hugging Face, then runs on your computer to cut the subject
            out. Nothing is sent to our servers.
          </p>
        </section>

        <section>
          <h2>1. You add a photo</h2>
          <p>
            Drop a file, click to browse, or paste a screenshot, copied image, or
            image link. The file is read locally in your browser memory.
          </p>
        </section>

        <section>
          <h2>2. The model downloads (first time only)</h2>
          <p>
            On the first run, this page fetches an open model called{" "}
            <strong>RMBG-1.4</strong> from{" "}
            <a
              href="https://huggingface.co/briaai/RMBG-1.4"
              target="_blank"
              rel="noreferrer"
            >
              Hugging Face
            </a>
            , a public library of AI models. That download is roughly tens of
            megabytes. Your browser caches it, so later visits are much faster.
          </p>
          <p>
            Think of it like installing a filter pack once, then using it offline
            afterward. The model files live in your browser cache, not on a
            mystery cloud account.
          </p>
        </section>

        <section>
          <h2>3. Cutout happens on your device</h2>
          <p>
            The model looks at the pixels and estimates what is “subject” versus
            “background.” It builds a mask (like a stencil), then we keep the
            subject and make the rest transparent. That work uses your CPU/GPU
            through the browser. Your photo is not uploaded for processing.
          </p>
        </section>

        <section>
          <h2>4. Optional edits, then download</h2>
          <p>
            After the cutout, you can recolor it or crop it. Recent results are
            saved in this browser only (IndexedDB), so a refresh does not wipe
            them. When you download a PNG, it saves to your computer like any
            other file download.
          </p>
        </section>

        <section>
          <h2>FAQ</h2>
          <dl className="faq-list">
            <div>
              <dt>Do images leave my device?</dt>
              <dd>
                No. Processing runs in your browser. We do not receive your
                photos.
              </dd>
            </div>
            <div>
              <dt>What about the Hugging Face download?</dt>
              <dd>
                That request fetches the model weights (the AI “brain”), not your
                image. Your photo never goes to Hugging Face as part of this
                flow.
              </dd>
            </div>
            <div>
              <dt>Is it free?</dt>
              <dd>
                Yes. The app is open source, and the cutout runs with the local
                model in your browser.
              </dd>
            </div>
            <div>
              <dt>Why is the first run slow?</dt>
              <dd>
                The model has to download and load once. After that, it is
                cached and much quicker.
              </dd>
            </div>
          </dl>
        </section>
      </article>

      <p className="explain__cta">
        <Link to="/" className="btn btn--primary">
          Try it
        </Link>
      </p>

      <SiteFooter />
    </div>
  );
}
