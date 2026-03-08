import { motion } from "framer-motion";

export function CTASection() {
  return (
    <section className="relative isolate overflow-hidden bg-background py-24 sm:py-32">
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-indigo-500/20 via-background to-background" />

      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-5xl">
            Adopt the BAZDMEG Method
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
            Stop letting AI generate slop. Start using quality gates. Enforce the 8 principles on every pull request, and watch your velocity and codebase health soar.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <a
              href="https://github.com/spike-land-ai/spike-land/tree/main/.claude/skills/bazdmeg"
              target="_blank"
              rel="noreferrer"
              className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Get the Skill
            </a>
            <a
              href="https://github.com/spike-land-ai/spike-land"
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold leading-6 hover:text-primary transition-colors"
            >
              View Documentation <span aria-hidden="true">→</span>
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
