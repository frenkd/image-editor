import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { PageSeo } from "../lib/seo";
import { Seo } from "./Seo";
import { SiteFooter } from "./SiteFooter";

type DocShellProps = {
  page: PageSeo;
  title: string;
  jsonLd?: Record<string, unknown>[];
  children: ReactNode;
};

export function DocShell({ page, title, jsonLd, children }: DocShellProps) {
  return (
    <div className="studio doc">
      <Seo page={page} jsonLd={jsonLd} />

      <header className="studio__header">
        <div>
          <p className="explain__back">
            <Link to="/">← Remove background</Link>
          </p>
          <h1 className="studio__title">{title}</h1>
        </div>
      </header>

      <div className="doc__body">{children}</div>

      <SiteFooter />
    </div>
  );
}
