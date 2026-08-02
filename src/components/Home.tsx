import { Link } from "react-router-dom";
import { Seo } from "./Seo";
import { homeSeo, webAppJsonLd } from "../lib/seo";

const tools = [
  {
    to: "/remove-background",
    kicker: "01",
    title: "Remove background",
    description:
      "Free AI background remover in your browser. Cut out photos, logos, and people locally, then recolor the cutout black, white, or any color.",
    meta: "Remove image bg · free",
  },
  {
    to: "/crop-image",
    kicker: "02",
    title: "Crop image",
    description:
      "Crop screenshots and photos with freeform or locked aspect ratios. Built for chopping UI captures and framing subjects.",
    meta: "Aspect presets",
  },
] as const;

export function Home() {
  return (
    <div className="home">
      <Seo page={homeSeo} jsonLd={[webAppJsonLd()]} />
      <div className="home__atmosphere" aria-hidden />
      <header className="home__header">
        <h1 className="home__brand">Image Editor</h1>
        <p className="home__lede">
          Free local tools to remove image backgrounds and crop screenshots.
          Open source, no upload cloud: processing stays on your laptop.
        </p>
      </header>

      <nav className="tool-grid" aria-label="Tools">
        {tools.map((tool) => (
          <Link key={tool.to} to={tool.to} className="tool-card">
            <div className="tool-card__top">
              <span className="tool-card__kicker">{tool.kicker}</span>
              <span className="tool-card__meta">{tool.meta}</span>
            </div>
            <h2 className="tool-card__title">{tool.title}</h2>
            <p className="tool-card__desc">{tool.description}</p>
            <span className="tool-card__cta">
              Open <span aria-hidden>→</span>
            </span>
          </Link>
        ))}
      </nav>

      <section className="seo-panel" aria-labelledby="seo-home-heading">
        <h2 id="seo-home-heading">Remove background &amp; crop, locally</h2>
        <p>
          Looking for a free way to remove image background, erase a photo
          background, or cut out a logo? This open-source image editor runs an
          on-device AI background remover (RMBG-1.4) so your files never leave
          the browser. Paste a screenshot, drop a PNG, or paste an image link,
          then download a transparent cutout. Need to trim UI captures? Use the
          crop tool with 16:9, 1:1, and other aspect presets.
        </p>
      </section>

      <footer className="home__footer">
        <span>MIT · open source</span>
        <span>
          Made by{" "}
          <a
            href="https://github.com/frenkd"
            target="_blank"
            rel="noreferrer"
          >
            frenkd
          </a>
        </span>
        <span>
          Source on{" "}
          <a
            href="https://github.com/frenkd/image-editor"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </span>
        <span>Models download from Hugging Face on first use</span>
      </footer>
    </div>
  );
}
