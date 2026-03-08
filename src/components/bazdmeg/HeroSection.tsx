import { motion } from "framer-motion";

export function HeroSection() {
  return (
    <section className="relative w-full overflow-hidden bg-background py-20 lg:py-32">
      {/* Decorative background gradient */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-background" />

      <div className="container relative z-10 mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mx-auto max-w-4xl"
        >
          <div className="mb-6 inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary shadow-sm glassmorphism">
            ✨ Quality Gates for AI-Assisted Development
          </div>
<<<<<<< HEAD

          <h1 className="mb-6 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent sm:text-7xl">
            The BAZDMEG Method
          </h1>

=======
          
          <h1 className="mb-6 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent sm:text-7xl">
            The BAZDMEG Method
          </h1>
          
>>>>>>> auto-pr-1772961809
          <p className="mx-auto mb-10 max-w-2xl text-xl leading-relaxed text-muted-foreground sm:text-2xl">
            Eight principles for AI-assisted development. Born from pain. Tested in production.
            Stop reviewing slop and start shipping quality.
          </p>
<<<<<<< HEAD

=======
          
>>>>>>> auto-pr-1772961809
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <a
              href="#principles"
              className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              Explore the 8 Principles
            </a>
            <a
              href="https://github.com/spike-land-ai/spike-land"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              Read the Spec
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
