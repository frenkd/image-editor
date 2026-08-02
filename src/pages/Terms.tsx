import { DocShell } from "../components/DocShell";
import { termsSeo } from "../lib/seo";

export function Terms() {
  return (
    <DocShell page={termsSeo} title="Terms">
      <div className="legal">
        <p>
          This is a free, open-source browser tool provided as-is. Use it at
          your own risk.
        </p>

        <h2>The service</h2>
        <p>
          You may use the background remover for personal or commercial projects,
          subject to any license terms of the open-source code and the third-party
          model you download in the browser. Results are not guaranteed to be
          perfect for every image.
        </p>

        <h2>Your content</h2>
        <p>
          You are responsible for images you process and for having the rights to
          use them. Do not use the tool for unlawful material.
        </p>

        <h2>No warranty</h2>
        <p>
          The tool is provided without warranties of any kind. We are not liable
          for lost data, incorrect cutouts, downtime, or damages arising from
          use. Browser storage can be cleared by you or your browser at any time.
        </p>

        <h2>Changes</h2>
        <p>
          These terms may be updated in the repository or on this page as the
          project evolves.
        </p>
      </div>
    </DocShell>
  );
}
