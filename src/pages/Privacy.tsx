import { DocShell } from "../components/DocShell";
import { privacySeo } from "../lib/seo";

export function Privacy() {
  return (
    <DocShell page={privacySeo} title="Privacy">
      <div className="legal">
        <p>
          This tool is built to keep your images on your device. We do not
          operate an upload API for photos you process here.
        </p>

        <h2>What stays local</h2>
        <p>
          Images you paste or drop are handled in your browser. Background
          removal runs on-device. Recent cutouts are stored in this browser
          (IndexedDB) until you clear them or clear site data.
        </p>

        <h2>What leaves the device</h2>
        <p>
          On first use, your browser downloads an open AI model from Hugging Face
          (model files only, not your photos). The site may load normal web
          assets (HTML, scripts, fonts) from its host. If analytics are enabled
          on the deployment, anonymous usage metrics may be collected by the
          host (for example page views), not your image contents.
        </p>

        <h2>Contact</h2>
        <p>
          Questions: open an issue on{" "}
          <a
            href="https://github.com/frenkd/image-editor"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          .
        </p>
      </div>
    </DocShell>
  );
}
