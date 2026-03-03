export function LandingPage() {
  return (
    <div className="bg-white dark:bg-gray-900">
      <div className="relative isolate px-6 pt-14 lg:px-8">
        <div className="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56">
          <div className="text-center">
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
              The AI Agent Workspace. Build, compose, and deploy full-stack blocks.
              Powered by Isomorphic Hyper-Blocks and Cloudflare Workers.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <a
                href="/app"
                className="rounded-md bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Go to App
              </a>
              <a href="/blog" className="text-sm font-semibold leading-6 text-gray-900 dark:text-white">
                Read the Blog <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
