export function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-3xl font-bold">About spike.land</h1>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">What is spike.land?</h2>
        <p className="leading-relaxed text-gray-700">
          spike.land is an AI development platform for building, deploying, and managing AI-powered
          applications with real-time collaboration. It combines a powerful MCP tool registry, live
          code editing, and real-time collaboration into a single cohesive platform.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Key Features</h2>
        <ul className="list-inside list-disc space-y-2 text-gray-700">
          <li>80+ MCP tools available through the tool registry</li>
          <li>Real-time collaboration</li>
          <li>Live code editor with Monaco and instant preview</li>
          <li>App store for discovering and sharing AI applications</li>
          <li>Edge-deployed on Cloudflare Workers for global low-latency access</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Open Source</h2>
        <p className="leading-relaxed text-gray-700">
          spike.land is built in the open. Visit our{" "}
          <a
            href="https://github.com/spike-land-ai"
            className="text-blue-600 underline hover:text-blue-800"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub organization
          </a>{" "}
          to explore the source code, report issues, or contribute.
        </p>
      </section>
    </div>
  );
}
