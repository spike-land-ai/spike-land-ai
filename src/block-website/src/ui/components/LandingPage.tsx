import { LandingHero } from "./landing/LandingHero";
import { BlogListView } from "./BlogList";
import { motion } from "framer-motion";

export function LandingPage() {
  return (
    <div className="bg-zinc-950 min-h-screen text-white overflow-x-hidden">
      <LandingHero />
      
      <section className="py-24 bg-zinc-900/50 border-y border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              The Database for Agents
            </h2>
            <p className="mt-4 text-lg text-zinc-400 max-w-2xl mx-auto">
              Agents subscribe, tools register, tasks flow. 
              Built on SpacetimeDB for real-time coordination.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-24">
        <BlogListView />
      </section>
    </div>
  );
}
