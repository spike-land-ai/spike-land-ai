"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/components/ui/link";
import { ArrowRight } from "lucide-react";
import { type ReactNode } from "react";

interface FeaturedAppCardProps {
  name: string;
  description: string;
  icon: ReactNode;
  href: string;
  featured?: boolean;
  tagline?: string;
}

export function FeaturedAppCard({
  name,
  description,
  icon,
  href,
  featured = false,
  tagline,
}: FeaturedAppCardProps) {
  return (
    <Card
      className={`group transition-all hover:scale-[1.02] ${
        featured
          ? "col-span-full md:col-span-2 border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5"
          : ""
      }`}
      data-testid={featured ? "featured-app-card" : "app-card"}
    >
      <CardHeader className={featured ? "pb-4" : "pb-3"}>
        <div
          className={`mb-3 flex items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-lg transition-transform group-hover:scale-110 ${
            featured ? "h-16 w-16" : "h-14 w-14"
          }`}
        >
          {icon}
        </div>
        <CardTitle className={featured ? "text-2xl" : "text-lg"}>
          {name}
        </CardTitle>
        {tagline && (
          <span className="text-sm text-primary font-medium">
            {tagline}
          </span>
        )}
        {featured && (
          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary w-fit">
            Featured
          </span>
        )}
      </CardHeader>
      <CardContent className={featured ? "space-y-4" : ""}>
        <CardDescription
          className={`leading-relaxed ${featured ? "text-base" : "text-sm"}`}
        >
          {description}
        </CardDescription>
        {featured && (
          <Button asChild className="mt-4">
            <Link href={href}>
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}
        {!featured && (
          <Button asChild variant="ghost" size="sm" className="mt-4 -ml-2">
            <Link href={href}>
              Learn More
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
