import React from "react";
import { PortfolioCard } from "../../../components/agency/portfolio-card";

const PORTFOLIO_ITEMS = [
  {
    id: 1,
    title: "Vibe-Coded Marketing Site",
    description: "A modern, fast marketing website built with the latest tools.",
    imageUrl: "https://placehold.co/600x400",
    link: "#",
  },
  {
    id: 2,
    title: "E-Commerce Dashboard",
    description: "Internal tool for managing products and orders.",
    imageUrl: "https://placehold.co/600x400",
    link: "#",
  },
  {
    id: 3,
    title: "AI Companion App",
    description: "Mobile-first application leveraging large language models.",
    imageUrl: "https://placehold.co/600x400",
    link: "#",
  },
];

export function PortfolioPage() {
  return (
    <div className="container mx-auto py-12 px-4 max-w-6xl">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold mb-4">Our Portfolio</h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Showcasing some of our best vibe-coded applications and digital experiences.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {PORTFOLIO_ITEMS.map((item) => (
          <PortfolioCard
            key={item.id}
            title={item.title}
            description={item.description}
            imageUrl={item.imageUrl}
            link={item.link}
          />
        ))}
      </div>
    </div>
  );
}
