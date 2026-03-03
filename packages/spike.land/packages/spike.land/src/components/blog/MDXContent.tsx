"use client";

import type { MDXRemoteSerializeResult } from "next-mdx-remote";
import { MDXRemote } from "next-mdx-remote";
import { mdxComponents } from "./MDXComponents";

interface MDXContentProps {
  source: MDXRemoteSerializeResult;
}

/**
 * Client component wrapper for MDX content rendering
 * This enables the use of interactive components like ImageComparisonSlider
 */
export function MDXContent({ source }: MDXContentProps) {
  return (
    <div>
      <MDXRemote {...source} components={mdxComponents} />
    </div>
  );
}
