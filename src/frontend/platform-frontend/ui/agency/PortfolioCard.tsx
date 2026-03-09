import React from "react";

interface PortfolioCardProps {
  title: string;
  description: string;
  imageUrl?: string;
  link?: string;
}

export function PortfolioCard({ title, description, imageUrl, link }: PortfolioCardProps) {
  return (
    <div className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {imageUrl && (
        <div className="aspect-video w-full overflow-hidden bg-gray-100">
          <img src={imageUrl} alt={title} className="object-cover w-full h-full" />
        </div>
      )}
      <div className="p-4">
        <h3 className="font-semibold text-lg mb-2">{title}</h3>
        <p className="text-gray-600 text-sm mb-4">{description}</p>
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            View Project &rarr;
          </a>
        )}
      </div>
    </div>
  );
}
