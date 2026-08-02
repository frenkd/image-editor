import { Link } from "react-router-dom";

export function SiteFooter() {
  return (
    <footer className="studio__footer">
      <span>
        Made by{" "}
        <a href="https://github.com/frenkd" target="_blank" rel="noreferrer">
          frenkd
        </a>
      </span>
      <span aria-hidden>·</span>
      <Link to="/how-it-works">How it works</Link>
      <span aria-hidden>·</span>
      <Link to="/faq">FAQ</Link>
      <span aria-hidden>·</span>
      <Link to="/privacy">Privacy</Link>
      <span aria-hidden>·</span>
      <Link to="/terms">Terms</Link>
      <span aria-hidden>·</span>
      <a
        href="https://github.com/frenkd/image-editor"
        target="_blank"
        rel="noreferrer"
      >
        GitHub
      </a>
    </footer>
  );
}
