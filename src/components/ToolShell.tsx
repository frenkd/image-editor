import { Link } from "react-router-dom";
import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
  actions?: ReactNode;
};

export function ToolShell({ title, subtitle, children, actions }: Props) {
  return (
    <div className="tool-shell">
      <header className="tool-shell__header">
        <div className="tool-shell__nav">
          <Link to="/" className="back-link">
            <span aria-hidden>←</span> All tools
          </Link>
          {actions}
        </div>
        <div className="tool-shell__titles">
          <h1 className="tool-shell__title">{title}</h1>
          <p className="tool-shell__subtitle">{subtitle}</p>
        </div>
      </header>
      <div className="tool-shell__body">{children}</div>
    </div>
  );
}
