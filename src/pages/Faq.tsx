import { Link } from "react-router-dom";
import { DocShell } from "../components/DocShell";
import { FAQ_ITEMS } from "../lib/faq";
import { faqSeo, removeBgFaqJsonLd } from "../lib/seo";

export function Faq() {
  return (
    <DocShell page={faqSeo} title="FAQ" jsonLd={[removeBgFaqJsonLd()]}>
      <dl className="faq-list">
        {FAQ_ITEMS.map((item) => (
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
