import { Link } from "react-router-dom";

const tools = [
  {
    to: "/remove-bg",
    kicker: "01",
    title: "Remove background",
    description:
      "Cut subjects out locally with RMBG-1.4 from Hugging Face. First run downloads the model; after that it stays cached in your browser.",
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
  {
    to: "/overlay",
    kicker: "03",
    title: "Overlay",
    description:
      "Stack a cutout or sticker on a base image. Drag to place, scale and fade opacity, then export a PNG.",
    meta: "Compose layers",
  },
] as const;

export function Home() {
  return (
    <div className="home">
      <div className="home__atmosphere" aria-hidden />
      <header className="home__header">
        <p className="home__brand">Image Editor</p>
        <p className="home__lede">
          Local-first tools for cutting up screenshots, knocking out
          backgrounds, and stacking overlays — open source, no upload cloud.
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
        <span>Models download from Hugging Face on first use</span>
      </footer>
    </div>
  );
}
