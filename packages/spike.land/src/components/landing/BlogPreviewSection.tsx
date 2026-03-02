"use client";

import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, Newspaper, Tag } from "lucide-react";

const posts = [
  {
    title: "How AI Agents Build Production Apps",
    description:
      "A deep dive into how recursive AI agents generate, test, and deploy full-stack applications on the spike.land platform.",
    category: "Engineering",
    date: "Feb 10, 2026",
    readTime: "6 min read",
    color: "from-cyan-500/20 to-blue-500/20",
  },
  {
    title: "Getting Started with MCP on Spike Land",
    description:
      "Connect Claude, Cursor, or any MCP client to spike.land and unlock database, AI, testing, and file system tools in minutes.",
    category: "Tutorial",
    date: "Feb 5, 2026",
    readTime: "4 min read",
    color: "from-fuchsia-500/20 to-purple-500/20",
  },
  {
    title: "From Prompt to Production in 30 Seconds",
    description:
      "Watch an AI agent turn a single sentence into a deployed app with routing, state management, and live preview.",
    category: "Guide",
    date: "Jan 28, 2026",
    readTime: "5 min read",
    color: "from-emerald-500/20 to-green-500/20",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut" as const,
    },
  },
};

export function BlogPreviewSection() {
  return (
    <section className="relative py-24 sm:py-32 bg-background overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="container relative mx-auto px-4">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="mx-auto max-w-6xl"
        >
          {/* Header */}
          <div className="flex flex-col md:flex-row items-end justify-between mb-16 gap-6">
            <div className="max-w-2xl">
              <motion.div variants={itemVariants} className="flex items-center gap-2 mb-4">
                <span className="p-2 rounded-lg bg-background/5 border border-border text-cyan-400">
                  <Newspaper className="w-5 h-5" />
                </span>
                <span className="text-sm font-medium text-cyan-400">Latest Updates</span>
              </motion.div>

              <motion.h2
                variants={itemVariants}
                className="text-3xl md:text-5xl font-bold text-foreground mb-6"
              >
                From the{" "}
                <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                  Engineering Blog
                </span>
              </motion.h2>

              <motion.p variants={itemVariants} className="text-lg text-muted-foreground">
                Engineering deep-dives, tutorials, and platform updates.
              </motion.p>
            </div>

            <motion.div variants={itemVariants}>
              <Button
                asChild
                variant="ghost"
                className="rounded-full px-8 py-6 bg-secondary/30 border border-border/50 hover:bg-secondary/50 gap-2 group"
              >
                <Link href="/blog">
                  View all posts
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </motion.div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post, index) => (
              <motion.div key={index} variants={itemVariants} className="group relative h-full">
                {/* Glow behind the card on hover */}
                <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/0 via-cyan-500/20 to-purple-500/0 opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-700 z-0" />

                <Link
                  href="/blog"
                  aria-label={`Read article: ${post.title}`}
                  className="block h-full group/link relative z-10"
                >
                  <div className="h-full flex flex-col bg-background/80 border border-border rounded-[32px] overflow-hidden hover:border-cyan-500/40 hover:bg-card/60 transition-all duration-500 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.6)] hover:shadow-[0_30px_60px_-15px_rgba(6,182,212,0.3)] hover:-translate-y-3 backdrop-blur-3xl group-hover:scale-[1.02]">
                    {/* Abstract noise pattern */}
                    <div className="absolute inset-0 opacity-10 mix-blend-overlay pointer-events-none bg-[url('/noise.png')] z-0 group-hover:opacity-20 transition-opacity duration-500" />

                    {/* Top glass reflection */}
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent z-20 opacity-40 group-hover:opacity-100 transition-opacity duration-500" />

                    {/* Gradient Header */}
                    <div
                      className={`h-56 w-full bg-gradient-to-br ${post.color} relative overflow-hidden`}
                    >
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-[url('/noise.png')] opacity-30 mix-blend-overlay"
                      />

                      {/* Image simulation gradient layers inside header */}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent z-10" />
                      <div className="absolute inset-0 bg-gradient-to-r from-background/40 to-transparent z-10" />

                      <div className="absolute top-5 left-5 z-20">
                        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-background/80 backdrop-blur-md border border-border text-xs font-semibold tracking-wide text-foreground/90 group-hover:border-cyan-400/40 transition-colors shadow-lg">
                          <Tag className="w-3.5 h-3.5 text-cyan-400" />
                          {post.category}
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="relative flex-1 p-8 sm:p-10 flex flex-col z-20">
                      <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground mb-5 tracking-widest uppercase">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-cyan-500" />
                          {post.date}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-border" />
                        <span>{post.readTime}</span>
                      </div>

                      <h3 className="text-2xl font-bold text-foreground mb-4 group-hover:text-cyan-400 transition-colors duration-300 drop-shadow-sm leading-snug">
                        {post.title}
                      </h3>

                      <p className="text-muted-foreground/90 text-[15px] leading-relaxed mb-8 flex-1 group-hover:text-muted-foreground transition-colors font-light">
                        {post.description}
                      </p>

                      <div className="flex items-center text-sm font-bold tracking-wider text-cyan-500/80 uppercase group-hover:text-cyan-400 transition-colors">
                        Read article{" "}
                        <ArrowRight className="ml-2 w-4 h-4 transition-transform duration-500 group-hover:translate-x-2" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
