import { Link } from "react-router-dom";

const tools = [
  {
    to: "/remove-bg",
    kicker: "01",
    title: "Remove background",
    description:
      "Cut subjects out locally with RMBG-1.4, then recolor the cutout black, white, or any color. First run downloads the model; then it stays cached.",
    meta: "On-device · free",
  },
  {
    to: "/crop",
    kicker: "02",
    title: "Crop",
    description:
      "Trim screenshots and photos with freeform or locked aspect ratios. Built for chopping UI captures and framing subjects.",
    meta: "Aspect presets",
  },
] as const;

export function Home() {
  return (
    <div className="home">
      <div className="home__atmosphere" aria-hidden />
      <header className="home__header">
        <p className="home__brand">Image Editor</p>
        <p className="home__lede">
          Local-first tools for cutting up screenshots and knocking out
          backgrounds. Open source, no upload cloud.
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
