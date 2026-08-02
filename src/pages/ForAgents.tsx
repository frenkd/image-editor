import { useEffect } from "react";
import { Link } from "react-router-dom";
import { DocShell } from "../components/DocShell";
import { trackAgentGuideView } from "../lib/analytics";
import {
  absoluteUrl,
  forAgentsSeo,
  softwareAppJsonLd,
} from "../lib/seo";

type Recipe = {
  id: string;
  title: string;
  lead: string;
  prompt: string;
};

const RECIPES: Recipe[] = [
  {
    id: "claude",
    title: "Claude",
    lead: "Ask Claude to remove a background from an image URL without uploading the photo to a third-party cutout API.",
    prompt: `GET https://cutbg.vercel.app/api/capabilities?via=agent
Then open https://cutbg.vercel.app/?src=<IMAGE_URL>&via=agent&crop=auto in the browser so cutbg removes the background locally. Do not clone the GitHub repo. Tell me when the PNG is ready to download.`,
  },
  {
    id: "chatgpt",
    title: "ChatGPT",
    lead: "Same flow for ChatGPT with browsing or computer use: discover via HTTP, then open the deep link.",
    prompt: `How to make ChatGPT remove a background from an image: fetch https://cutbg.vercel.app/llms.txt and https://cutbg.vercel.app/api/capabilities?via=agent, then open https://cutbg.vercel.app/?src=<IMAGE_URL>&via=agent&color=%23e85d04&crop=auto so cutbg runs in the tab. No clone.`,
  },
  {
    id: "codex",
    title: "Codex / coding agents",
    lead: "Cursor, Codex, and similar agents should use HTTP discovery plus the web deep link.",
    prompt: `Use cutbg at https://cutbg.vercel.app. GET /api/capabilities?via=agent and /llms.txt. Remove the background of <IMAGE_URL> by opening /?src=<IMAGE_URL>&via=agent&advanced=1&crop=auto. Do not clone the repo.`,
  },
];

const STEPS = [
  {
    n: "1",
    title: "Discover (HTTP)",
    body: "GET /api/capabilities, /llms.txt, or /agents.txt. No clone. CORS is open on these resources.",
  },
  {
    n: "2",
    title: "Open a deep link",
    body: "Open /?src=<encoded-image-url>&via=agent with optional color, crop, and advanced. via=agent tags Analytics as agent usage.",
  },
  {
    n: "3",
    title: "Cutout in the tab",
    body: "The model runs in the browser. The image is not uploaded to cutbg servers. CORS must allow the image URL.",
  },
  {
    n: "4",
    title: "Download",
    body: "The human (or an agent with browser control) downloads the PNG from the studio.",
  },
];

function forAgentsJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: forAgentsSeo.title,
    description: forAgentsSeo.description,
    url: absoluteUrl(forAgentsSeo.path),
    step: STEPS.map((step, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: step.title,
      text: step.body,
    })),
  };
}

function forAgentsFaqJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How do I make Claude remove a background from an image?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Have Claude GET https://cutbg.vercel.app/api/capabilities?via=agent, then open https://cutbg.vercel.app/?src=<image-url>&via=agent so the local web app runs RMBG-1.4 in the browser. Add &crop=auto or &color=%23rrggbb as needed. No GitHub clone.",
        },
      },
      {
        "@type": "Question",
        name: "Can ChatGPT or Codex use cutbg without cloning GitHub?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Agents should use HTTP discovery and the hosted deep link. Cloning the repo is not required.",
        },
      },
      {
        "@type": "Question",
        name: "How is agent traffic tagged in analytics?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Add via=agent on deep links and on /api/capabilities. cutbg sends Vercel Analytics custom events cutout_start and agent_discover with a client or via property so agent usage can be filtered separately from human UI uploads.",
        },
      },
    ],
  };
}

export function ForAgents() {
  useEffect(() => {
    trackAgentGuideView();
  }, []);

  return (
    <DocShell
      page={forAgentsSeo}
      title="For AI agents"
      jsonLd={[
        forAgentsJsonLd(),
        forAgentsFaqJsonLd(),
        softwareAppJsonLd(forAgentsSeo),
      ]}
    >
      <p className="doc__lede">
        Built so Claude, ChatGPT, Codex, and other AI agents can remove image
        backgrounds from the web. No clone required. Discover over HTTP, open a
        deep link, and the cutout runs in the browser.
      </p>

      <ol className="flow-steps">
        {STEPS.map((step) => (
          <li key={step.n} className="flow-steps__item">
            <span className="flow-steps__n" aria-hidden>
              {step.n}
            </span>
            <h2 className="flow-steps__title">{step.title}</h2>
            <p className="flow-steps__body">{step.body}</p>
          </li>
        ))}
      </ol>

      <section className="agent-guide" aria-labelledby="http-api">
        <h2 id="http-api">Discover by request</h2>
        <p>
          Agents should prefer a simple GET. This returns capabilities as JSON
          and records an <code>agent_discover</code> analytics event:
        </p>
        <pre className="agent-guide__code">
          <code>{`GET https://cutbg.vercel.app/api/capabilities?via=agent`}</code>
        </pre>
        <p>Also available (CORS enabled):</p>
        <ul className="agent-guide__list">
          <li>
            <a href="/llms.txt">/llms.txt</a>
          </li>
          <li>
            <a href="/agents.txt">/agents.txt</a>
          </li>
          <li>
            <a href="/agents.json">/agents.json</a>
          </li>
          <li>
            <a href="/agent-skills/remove-background/SKILL.md">
              remove-background skill
            </a>
          </li>
        </ul>
      </section>

      <section className="agent-guide" aria-labelledby="deep-link">
        <h2 id="deep-link">Web deep link</h2>
        <p>Encode the image URL, then open (always include <code>via=agent</code>):</p>
        <pre className="agent-guide__code">
          <code>
            {`https://cutbg.vercel.app/?src=<IMAGE_URL>&via=agent&crop=auto&advanced=1
https://cutbg.vercel.app/?src=<IMAGE_URL>&via=agent&color=%23e85d04&crop=auto`}
          </code>
        </pre>
        <ul className="agent-guide__list">
          <li>
            <code>src</code> / <code>url</code> / <code>image</code>: image URL
            (CORS must allow the browser tab)
          </li>
          <li>
            <code>via=agent</code>: tags the cutout as agent usage in Analytics
          </li>
          <li>
            <code>color</code> / <code>fill</code>: <code>#rrggbb</code> recolor
          </li>
          <li>
            <code>crop=auto</code> or <code>x,y,w,h</code>
          </li>
          <li>
            <code>advanced=1</code>: speckle + tiny hole cleanup
          </li>
        </ul>
      </section>

      <section className="agent-guide" aria-labelledby="analytics">
        <h2 id="analytics">Human vs agent analytics</h2>
        <p>
          Stock Vercel page views do not cleanly separate AI agents. cutbg adds
          custom events you can filter in the Vercel Analytics Events panel:
        </p>
        <ul className="agent-guide__list">
          <li>
            <code>cutout_start</code> with <code>client=human</code> (drag/paste
            in the UI), <code>client=agent</code> (<code>via=agent</code>), or{" "}
            <code>client=deep_link</code> (URL without via)
          </li>
          <li>
            <code>agent_discover</code> when something hits{" "}
            <code>/api/capabilities</code>
          </li>
          <li>
            <code>agent_guide_view</code> when this page loads
          </li>
        </ul>
        <p>
          Plain crawlers that only fetch static files and never run JavaScript
          still will not appear as Web Analytics page views. Use{" "}
          <code>/api/capabilities?via=agent</code> when you want discovery
          counted.
        </p>
      </section>

      <div className="use-cases">
        {RECIPES.map((item) => (
          <section
            key={item.id}
            id={item.id}
            className="use-case"
            aria-labelledby={`agent-${item.id}`}
          >
            <h2 className="use-case__title" id={`agent-${item.id}`}>
              How to make {item.title} remove a background
            </h2>
            <p className="use-case__lead">{item.lead}</p>
            <pre className="agent-guide__code">
              <code>{item.prompt}</code>
            </pre>
          </section>
        ))}
      </div>

      <p className="doc__note">
        Photos stay on the device during cutout. See{" "}
        <Link to="/how-it-works">how it works</Link>,{" "}
        <Link to="/use-cases">use cases</Link>, or the{" "}
        <Link to="/faq">FAQ</Link>.
      </p>

      <p className="explain__cta">
        <Link to="/" className="btn btn--primary">
          Open the app
        </Link>
      </p>
    </DocShell>
  );
}
