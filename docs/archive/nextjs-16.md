# Next.js 15 App Router Best Practices Guide

Comprehensive documentation covering modern Next.js 15 patterns, optimization
techniques, and production-ready implementations.

**Last Updated:** December 2025 | **Next.js Version:** 15+

---

## Table of Contents

1. [App Router Patterns](#app-router-patterns)
2. [Server vs Client Components](#server-vs-client-components)
3. [Data Fetching & Caching](#data-fetching--caching)
4. [Performance Optimization](#performance-optimization)
5. [Routing Strategies](#routing-strategies)
6. [Authentication & Security](#authentication--security)
7. [Deployment & Hosting](#deployment--hosting)
8. [Common Patterns](#common-patterns)
9. [Performance Comparison Tables](#performance-comparison-tables)
10. [Resources & Documentation](#resources--documentation)

---

## App Router Patterns

### Core Concepts

The App Router in Next.js 15 is a modern, performance-first full-stack model
that treats the server as your primary rendering surface. Key principles:

- **Server by Default:** Every component is a Server Component by default
- **Minimal Client JS:** Ship only interactive code to the browser
- **Explicit Caching:** Control data freshness explicitly through configuration
- **Streaming:** Progressive HTML delivery improves perceived performance

### Directory Structure Best Practices

```
src/
├── app/                              # App Router root
│   ├── layout.tsx                    # Root layout (required)
│   ├── page.tsx                      # Home page
│   ├── globals.css                   # Global styles
│   │
│   ├── (dashboard)/                  # Route group (doesn't affect URL)
│   │   ├── layout.tsx                # Dashboard layout
│   │   ├── page.tsx
│   │   ├── analytics/
│   │   │   └── page.tsx
│   │   └── settings/
│   │       └── page.tsx
│   │
│   ├── products/
│   │   ├── layout.tsx                # Shared layout
│   │   ├── page.tsx                  # /products
│   │   ├── [id]/                     # Dynamic segment
│   │   │   ├── page.tsx              # /products/[id]
│   │   │   ├── loading.tsx           # Loading skeleton
│   │   │   └── error.tsx             # Error boundary
│   │   └── [...all]/                 # Catch-all segment
│   │       └── page.tsx
│   │
│   ├── api/
│   │   └── products/
│   │       └── route.ts              # API route
│   │
│   └── auth/
│       ├── signin/
│       │   └── page.tsx
│       └── callback/
│           └── route.ts
│
├── components/                        # Organized by feature
│   ├── ui/                            # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── modal.tsx
│   ├── features/
│   │   ├── dashboard/
│   │   │   ├── DashboardHeader.tsx
│   │   │   └── DashboardChart.tsx
│   │   └── products/
│   │       ├── ProductCard.tsx
│   │       └── ProductList.tsx
│   └── common/
│       ├── Navigation.tsx
│       └── Footer.tsx
│
├── lib/
│   ├── utils.ts                      # Utility functions
│   ├── constants.ts
│   ├── api-client.ts                 # API utilities
│   └── db/                           # Database layer
│       └── index.ts
│
├── hooks/
│   ├── useAuth.ts
│   └── useFetch.ts
│
└── types/
    ├── index.ts
    └── api.ts
```

**Key Principles:**

- **Don't overcomplicate:** Avoid 200+ files in a single folder
- **Avoid deep nesting:** If your path looks like
  `src/components/features/dashboard/widgets/weather/current/small/index.tsx`,
  refactor
- **Separate concerns:** Keep `utils.ts` focused; break large files into logical
  groups
- **Organize by feature:** Group related components, hooks, and utilities
  together

### Special Files

```typescript
// layout.tsx - Persistent wrapper for segments
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <Sidebar />
        {children}
        <Footer />
      </body>
    </html>
  );
}

// page.tsx - Route UI (required to make segment accessible)
export default function Page() {
  return <h1>Hello, World!</h1>;
}

// loading.tsx - Suspense fallback during data fetch
export default function Loading() {
  return <div className="animate-pulse">Loading...</div>;
}

// error.tsx - Error boundary for segment
"use client";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}

// not-found.tsx - Custom 404 for segment
import Link from "next/link";

export default function NotFound() {
  return (
    <div>
      <h2>Page not found</h2>
      <Link href="/">Return home</Link>
    </div>
  );
}
```

---

## Server vs Client Components

### Quick Reference

| Aspect            | Server Components            | Client Components              |
| ----------------- | ---------------------------- | ------------------------------ |
| **Execution**     | Server-side only             | Browser-side                   |
| **Data Access**   | Direct database/API access   | Client-side APIs/fetch         |
| **Secrets**       | Can use private keys/secrets | Exposed to browser             |
| **Libraries**     | Node.js libraries            | Browser-compatible only        |
| **Bundle Size**   | Not included in JS           | Included in bundle             |
| **Interactivity** | No (no event handlers)       | Full (useState, onClick, etc.) |
| **Performance**   | Better (reduces JS sent)     | More JS to download            |

### When to Use Server Components

Use Server Components as the default. Only add `'use client'` when you need
interactivity.

**✅ Perfect for:**

```typescript
// Fetching data directly from database
export default async function ProductList() {
  const products = await db.products.findMany();
  return (
    <ul>
      {products.map((p) => <li key={p.id}>{p.name}</li>)}
    </ul>
  );
}

// Using environment variables and secrets
async function fetchUserData(id: string) {
  const response = await fetch("https://api.example.com/users/" + id, {
    headers: { Authorization: `Bearer ${process.env.API_SECRET}` },
  });
  return response.json();
}

// Server-only operations
import { sendEmail } from "@/lib/email";

export default async function ConfirmationPage() {
  await sendEmail({ to: "user@example.com" });
  return <p>Email sent!</p>;
}
```

### When to Use Client Components

Add `'use client'` only when you need browser-only features.

**✅ Necessary for:**

```typescript
"use client";

import { useEffect, useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    console.log("Component mounted");
  }, []);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}

// Using browser APIs
"use client";

export default function LocationDetector() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );

  useEffect(() => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setCoords({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
    });
  }, []);

  return coords
    ? <p>Your location: {coords.lat}, {coords.lng}</p>
    : <p>Detecting...</p>;
}

// Local state and event handlers
"use client";

import { useForm } from "react-hook-form";

export default function ContactForm() {
  const { register, handleSubmit } = useForm();

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("name")} placeholder="Your name" />
      <button type="submit">Send</button>
    </form>
  );
}
```

### Composition Patterns

**✅ Server Component with Client Component (Recommended):**

```typescript
// app/dashboard/page.tsx (Server Component)
import { ClientCharts } from "@/components/ClientCharts";
import { fetchDashboardData } from "@/lib/api";

export default async function DashboardPage() {
  const data = await fetchDashboardData();

  return (
    <div>
      <h1>Dashboard</h1>
      <ClientCharts data={data} />
    </div>
  );
}
```

**✅ Client Component with Server Component Children (Use composition):**

```typescript
// app/dashboard/layout.tsx (Server Component)
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <Sidebar />
      <main className="col-span-3">{children}</main>
    </div>
  );
}

// components/ClientFilter.tsx (Client Component)
"use client";

import { useState } from "react";

interface ClientFilterProps {
  children: React.ReactNode;
}

export function ClientFilter({ children }: ClientFilterProps) {
  const [filter, setFilter] = useState("");

  return (
    <div>
      <input value={filter} onChange={(e) => setFilter(e.target.value)} />
      <div>{/* Server component children are passed through */}</div>
    </div>
  );
}
```

**❌ Avoid:** Client Component trying to use Server Component directly

```typescript
// DON'T DO THIS - Server logic can't run in browser
"use client";

import { fetchSecret } from "@/lib/secrets"; // This won't work!

export default function BadComponent() {
  const secret = fetchSecret(); // Error: function not available in browser
  return <div>{secret}</div>;
}
```

---

## Data Fetching & Caching

### Fetch Patterns

#### Server Component Data Fetching

```typescript
// app/products/page.tsx
import { Product } from "@/types";

// Recommended: Async Server Component
export default async function ProductsPage() {
  // Fetch at build time (static), revalidate every hour
  const products: Product[] = await fetch(
    "https://api.example.com/products",
    {
      next: { revalidate: 3600 }, // ISR: Revalidate every hour
    },
  ).then((res) => res.json());

  return (
    <ul>
      {products.map((product) => <li key={product.id}>{product.name}</li>)}
    </ul>
  );
}
```

#### Caching Strategies

```typescript
// 1. Cache and revalidate periodically (ISR)
fetch(url, {
  next: { revalidate: 60 }, // Revalidate every 60 seconds
});

// 2. No caching - always fetch fresh
fetch(url, {
  cache: "no-store",
});

// 3. Force cache
fetch(url, {
  cache: "force-cache",
});

// 4. Tag-based revalidation (on-demand)
fetch(url, {
  next: { tags: ["products"] },
});

// In Server Action or Route Handler:
import { revalidateTag } from "next/cache";

export async function updateProduct(id: string, data: any) {
  // Update database
  await db.products.update(id, data);

  // Revalidate all fetches tagged with 'products'
  revalidateTag("products");
}
```

#### Route Segment Configuration

```typescript
// app/products/page.tsx

// Force static (build time only)
export const dynamic = "force-static";

// Force dynamic (always re-render)
export const dynamic = "force-dynamic";

// Default: static when possible, dynamic when needed
export const dynamic = "auto";

// Revalidation interval (ISR)
export const revalidate = 60; // seconds

// Request-specific caching
export const fetchCache = "auto";

// Data segments configuration
export const dynamicParams = true; // Allow unknown dynamic segments
```

### Server Actions

Server Actions are asynchronous functions that run on the server and can be
called from Client Components.

```typescript
// lib/actions.ts
"use server";

import { db } from "@/lib/db";

export async function createProduct(formData: FormData) {
  const name = formData.get("name") as string;
  const price = parseFloat(formData.get("price") as string);

  // Runs on server, has access to DB
  const product = await db.products.create({ name, price });

  return { success: true, product };
}

export async function deleteProduct(id: string) {
  await db.products.delete(id);
  revalidateTag("products");
}
```

Using Server Actions in forms:

```typescript
// app/products/new/page.tsx
import { createProduct } from "@/lib/actions";

export default function NewProductPage() {
  return (
    <form action={createProduct}>
      <input name="name" placeholder="Product name" required />
      <input name="price" type="number" placeholder="Price" required />
      <button type="submit">Create Product</button>
    </form>
  );
}
```

Using Server Actions with transitions (Client Component):

```typescript
"use client";

import { createProduct } from "@/lib/actions";
import { useTransition } from "react";

export default function ProductForm() {
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await createProduct(formData);
    });
  }

  return (
    <form action={handleSubmit}>
      <input name="name" disabled={pending} />
      <button disabled={pending}>{pending ? "Creating..." : "Create"}</button>
    </form>
  );
}
```

### Client-Side Data Fetching

For client-only needs, use community libraries like SWR or TanStack Query:

```typescript
// Using SWR
"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function UserProfile() {
  const { data, error, isLoading } = useSWR("/api/user", fetcher);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>Hello {data.name}</div>;
}
```

---

## Performance Optimization

### Image Optimization

Always use the `next/image` component instead of `<img>`:

```typescript
import Image from "next/image";

// Static import - dimensions inferred automatically
import heroImage from "@/public/hero.jpg";

export default function Hero() {
  return (
    <Image
      src={heroImage}
      alt="Hero image"
      priority // Load immediately (use sparingly)
      className="w-full h-auto"
    />
  );
}

// Remote images - require dimensions
export default function ProductImage({ imageUrl }: { imageUrl: string }) {
  return (
    <Image
      src={imageUrl}
      alt="Product image"
      width={400}
      height={300}
      quality={80}
      placeholder="blur"
      blurDataURL="data:image/..." // Generated by plaiceholder
    />
  );
}

// Responsive images
<Image
  src="/large-image.jpg"
  alt="Responsive"
  sizes="(max-width: 768px) 100vw, 50vw"
  style={{ width: "100%", height: "auto" }}
/>;
```

**Benefits:**

- Prevents layout shift (CLS)
- Lazy loads by default
- Serves modern formats (WebP, AVIF)
- Responsive images with `sizes`
- Automatic optimization

### Font Optimization

Use `next/font` for self-hosted fonts:

```typescript
// app/layout.tsx
import { Geist, Geist_Mono } from 'next/font/google';

const geist = Geist({ subsets: ['latin'] });
const geistMono = Geist_Mono({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={geist.variable}>
      <body className={geistMono.className}>{children}</body>
    </html>
  );
}

// Using CSS variables
const inter = Geist({
  variable: '--font-inter',
  subsets: ['latin'],
});

// In CSS:
body {
  font-family: var(--font-inter);
}
```

**Best Practices:**

- Use variable fonts (single file covers all weights/styles)
- Load only necessary weights and styles
- Subsets reduce file size (e.g., `subsets: ['latin']`)
- Automatic font smoothing and optimization
- Prevents layout shift during font load

### Bundle Optimization

```typescript
// 1. Dynamic imports for heavy components
import dynamic from "next/dynamic";

const HeavyChart = dynamic(() => import("@/components/HeavyChart"), {
  loading: () => <p>Loading chart...</p>,
  ssr: false, // Don't render on server if not needed
});

export default function Dashboard() {
  return (
    <>
      <h1>Dashboard</h1>
      <HeavyChart />
    </>
  );
}

// 2. Code splitting with route groups
// Automatically code-split by route

// 3. CSS optimization
// Tailwind CSS 4 provides excellent tree-shaking
// Use CSS modules for component-scoped styles

// 4. Monitor bundle size
// yarn build shows build size
```

### Proxy Performance

```typescript
// proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // Runs at Edge - very fast
  if (request.nextUrl.pathname.startsWith("/api/")) {
    // Add security headers
    const response = NextResponse.next();
    response.headers.set("X-Custom-Header", "value");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static
     * - favicon.ico
     * - public folder
     */
    "/((?!_next/static|favicon.ico|public).*)",
  ],
};
```

### Partial Prerendering (Experimental)

```typescript
// app/dashboard/page.tsx
import { DynamicContent } from "@/components/DynamicContent";
import { StaticHeader } from "@/components/StaticHeader";
import { Suspense } from "react";

// Generate static shell, stream dynamic parts
export const experimental_ppr = true;

export default function Dashboard() {
  return (
    <>
      <StaticHeader /> {/* Prerendered */}
      <Suspense fallback={<div>Loading...</div>}>
        <DynamicContent /> {/* Streamed */}
      </Suspense>
    </>
  );
}
```

---

## Routing Strategies

### Dynamic Routes

```typescript
// app/products/[id]/page.tsx
interface ProductPageProps {
  params: {
    id: string;
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const product = await db.products.findById(params.id);
  return <h1>{product.name}</h1>;
}

// Generate static routes at build time
export async function generateStaticParams() {
  const products = await db.products.findMany();
  return products.map((p) => ({ id: p.id }));
}

// Generate metadata for each product
import type { Metadata } from "next";

interface MetadataProps {
  params: { id: string };
}

export async function generateMetadata(
  { params }: MetadataProps,
): Promise<Metadata> {
  const product = await db.products.findById(params.id);
  return {
    title: product.name,
    description: product.description,
  };
}
```

### Catch-All Routes

```typescript
// app/docs/[...slug]/page.tsx
interface DocsPageProps {
  params: {
    slug: string[]; // e.g., ['guides', 'installation']
  };
}

export default async function DocsPage({ params }: DocsPageProps) {
  const path = params.slug.join("/");
  return <h1>Documentation: {path}</h1>;
}

// Optional catch-all: [[...slug]] matches root too
// app/docs/[[...slug]]/page.tsx
```

### Parallel Routes

Render multiple segments in the same layout:

```typescript
// app/dashboard/layout.tsx
interface DashboardLayoutProps {
  children: React.ReactNode;
  analytics: React.ReactNode; // Parallel slot
  users: React.ReactNode; // Parallel slot
}

export default function DashboardLayout({
  children,
  analytics,
  users,
}: DashboardLayoutProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div>{children}</div>
      <div>{analytics}</div>
      <div>{users}</div>
    </div>
  );
}

// File structure:
// app/dashboard/
//   ├── layout.tsx
//   ├── page.tsx
//   ├── @analytics/
//   │   └── page.tsx
//   └── @users/
//       └── page.tsx
```

### Intercepting Routes

Intercept routes and render in a modal:

```typescript
// app/feed/page.tsx
export default function Feed() {
  return <div>Feed with photos...</div>;
}

// app/feed/(.)photo/[id]/page.tsx - Intercepts /photo/[id] at same level
"use client";

import { Modal } from "@/components/Modal";

export default function PhotoModal({ params }: { params: { id: string } }) {
  return (
    <Modal>
      <img src={`/photos/${params.id}`} />
    </Modal>
  );
}

// File structure:
// app/feed/
//   ├── page.tsx
//   └── (.)photo/
//       └── [id]/
//           └── page.tsx
```

Intercepting route conventions:

- `(.)` - Same level
- `(..)` - One level above
- `(...)` - Two levels above
- `(...)` from root

---

## Authentication & Security

### NextAuth.js Setup

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

const handler = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
    Google({
      clientId: process.env.GOOGLE_ID,
      clientSecret: process.env.GOOGLE_SECRET,
    }),
    Credentials({
      async authorize(credentials) {
        const user = await db.users.findByEmail(credentials?.email);
        if (!user) return null;

        const passwordMatch = await verifyPassword(
          credentials?.password,
          user.password,
        );
        if (!passwordMatch) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.role = token.role as string;
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
```

### Proxy Authentication

```typescript
// proxy.ts
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Protect admin routes
  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!token || token.role !== "admin") {
      return NextResponse.redirect(new URL("/auth/signin", request.url));
    }
  }

  // Protect authenticated routes
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    if (!token) {
      return NextResponse.redirect(new URL("/auth/signin", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/api/protected/:path*"],
};
```

### Server Action Authentication

```typescript
// lib/actions.ts
"use server";

import { auth } from "@/lib/auth"; // getServerSession wrapper
import { db } from "@/lib/db";

export async function updateUserProfile(data: ProfileData) {
  // Verify user is authenticated
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  // Verify user owns the data
  const user = await db.users.findById(session.user.id);
  if (!user) {
    throw new Error("User not found");
  }

  // Update in database
  const updated = await db.users.update(session.user.id, data);

  // Revalidate cache
  revalidateTag(`user-${session.user.id}`);

  return updated;
}
```

### Data Access Layer (DAL) Pattern

```typescript
// lib/dal.ts
import { authConfig } from "@/lib/auth.config";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";

export async function getAuthenticatedUser() {
  const session = await getServerSession(authConfig);
  if (!session?.user?.email) {
    return null;
  }

  return db.users.findByEmail(session.user.email);
}

export async function getUserData(userId: string) {
  const user = await getAuthenticatedUser();
  if (!user || user.id !== userId) {
    throw new Error("Unauthorized");
  }

  return db.users.findById(userId);
}

export async function getUserProducts(userId: string) {
  const user = await getAuthenticatedUser();
  if (!user || user.id !== userId) {
    throw new Error("Unauthorized");
  }

  return db.products.findByUserId(userId);
}
```

### Security Headers

```typescript
// next.config.ts
import type { NextConfig } from "next";

const config: NextConfig = {
  headers: async () => {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline'",
          },
        ],
      },
    ];
  },
};

export default config;
```

---

## Deployment & Hosting

### Vercel Deployment

```bash
# Connect your GitHub repository
# Vercel automatically deploys on push

# Environment variables
# Set in Vercel dashboard or vercel.json

# Preview deployments
# Every PR gets a preview URL

# Production deployment
# Automatic when merged to main
```

### ISR (Incremental Static Regeneration)

Time-based revalidation:

```typescript
// app/blog/[slug]/page.tsx
export const revalidate = 3600; // Revalidate every hour

export default async function BlogPost(
  { params }: { params: { slug: string } },
) {
  const post = await db.posts.findBySlug(params.slug);
  return <article>{post.content}</article>;
}
```

On-demand revalidation:

```typescript
// app/api/revalidate/route.ts
import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-revalidate-secret");

  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tag = request.nextUrl.searchParams.get("tag");
  if (!tag) {
    return NextResponse.json({ error: "Missing tag" }, { status: 400 });
  }

  revalidateTag(tag);
  return NextResponse.json({ revalidated: true });
}
```

### Edge Functions

Deploy functions to Vercel's Edge Network for global latency:

```typescript
// app/api/geo/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const country = request.geo?.country;
  const city = request.geo?.city;

  return NextResponse.json({ country, city });
}
```

### Environment Variables

```bash
# .env.local (dev only)
DATABASE_URL=postgres://...
NEXT_PUBLIC_API_URL=http://localhost:3000

# .env.production (Vercel dashboard)
DATABASE_URL=postgres://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://example.com
```

```typescript
// Accessing in code
const dbUrl = process.env.DATABASE_URL; // Server only

const apiUrl = process.env.NEXT_PUBLIC_API_URL; // Public (exposed to client)
```

---

## Common Patterns

### Protected Page Pattern

```typescript
// app/dashboard/page.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/auth/signin");
  }

  return (
    <div>
      <h1>Welcome, {session.user.name}</h1>
      {/* Dashboard content */}
    </div>
  );
}
```

### Loading State Pattern

```typescript
// app/products/page.tsx
import { ProductList } from "@/components/ProductList";
import { ProductListSkeleton } from "@/components/ProductListSkeleton";
import { Suspense } from "react";

export default function ProductsPage() {
  return (
    <Suspense fallback={<ProductListSkeleton />}>
      <ProductList />
    </Suspense>
  );
}

// components/ProductList.tsx
async function ProductList() {
  const products = await db.products.findMany();
  return (
    <ul>
      {products.map((p) => <li key={p.id}>{p.name}</li>)}
    </ul>
  );
}
```

### Form with Server Action

```typescript
// app/create-product/page.tsx
"use client";

import { createProduct } from "@/lib/actions";
import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button disabled={pending}>{pending ? "Creating..." : "Create"}</button>
  );
}

export default function CreateProductPage() {
  return (
    <form action={createProduct}>
      <input name="name" placeholder="Product name" />
      <input name="price" type="number" placeholder="Price" />
      <SubmitButton />
    </form>
  );
}
```

### Error Handling

```typescript
// app/products/error.tsx
"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error reporting service
    console.error(error);
  }, [error]);

  return (
    <div>
      <h2>Something went wrong!</h2>
      <p>{error.message}</p>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
```

### API Routes

```typescript
// app/api/products/route.ts
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const products = await db.products.findMany();
  return NextResponse.json(products);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const product = await db.products.create(body);
  return NextResponse.json(product, { status: 201 });
}

// app/api/products/[id]/route.ts
interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const product = await db.products.findById(params.id);
  return NextResponse.json(product);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const body = await request.json();
  const product = await db.products.update(params.id, body);
  return NextResponse.json(product);
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  await db.products.delete(params.id);
  return NextResponse.json({ deleted: true });
}
```

---

## Performance Comparison Tables

### Rendering Strategies

| Strategy         | When Generated         | Cache Duration               | Use Case                       | SEO       |
| ---------------- | ---------------------- | ---------------------------- | ------------------------------ | --------- |
| **Static (SSG)** | Build time             | Infinite (until redeploy)    | Content pages, docs, blogs     | Best      |
| **ISR**          | Build time + on-demand | Configurable (60s, 1h, etc.) | Frequently updated content     | Excellent |
| **SSR**          | Request time           | Per request                  | Dynamic data, user-specific    | Good      |
| **CSR + SWR**    | Browser + background   | Library-controlled           | Real-time updates, interactive | Good*     |

**Best Practices Recommendations:**

- Default to SSG + ISR for most pages
- Use SSR only for user-specific or frequently-changing data
- CSR + SWR for real-time, interactive content
- *CSR alone is bad for SEO; avoid

### Image Optimization Impact

| Format   | Compression | Browser Support | Size  | LCP Impact |
| -------- | ----------- | --------------- | ----- | ---------- |
| **JPEG** | Baseline    | All             | 100%  | Baseline   |
| **PNG**  | Lossless    | All             | ~130% | +30%       |
| **WebP** | Modern      | 90%+            | -30%  | -15-20%    |
| **AVIF** | Best        | Growing         | -50%  | -20-30%    |

**Recommendations:**

- Always serve WebP/AVIF with fallbacks
- Use `next/image` for automatic format selection
- Optimize source images before upload
- Use `quality={80-85}` for photos

### Font Loading Performance

| Strategy                | FCP      | LCP      | Recommendation    |
| ----------------------- | -------- | -------- | ----------------- |
| Web fonts (unoptimized) | +400ms   | +600ms   | Avoid             |
| Web fonts (optimized)   | +100ms   | +150ms   | Good              |
| Variable fonts          | +80ms    | +100ms   | Best              |
| System fonts            | Baseline | Baseline | For critical text |

**Recommendations:**

- Use `next/font` for all web fonts
- Prefer variable fonts (single file for all weights)
- Load only necessary weights
- Use `font-display: swap` for faster perceived load

---

## Resources & Documentation

### Official Next.js Documentation

- [Next.js Official Docs](https://nextjs.org/docs)
- [App Router Guide](https://nextjs.org/docs/app/guides)
- [API Reference](https://nextjs.org/docs/app/api-reference)

### Learning Resources

- [Next.js Learn](https://nextjs.org/learn) - Interactive tutorials
- [React Foundations](https://nextjs.org/learn/react-foundations/server-and-client-components) -
  Server/Client Components
- [Building Your Application](https://nextjs.org/docs/app/building-your-application)

### Advanced Routing

- [Parallel Routes](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes)
- [Intercepting Routes](https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes)
- [Dynamic Routes](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)

### Data Fetching

- [Data Fetching Guide](https://nextjs.org/docs/app/getting-started/fetching-data)
- [Caching and Revalidation](https://nextjs.org/docs/app/getting-started/caching-and-revalidating)
- [Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)

### Authentication

- [NextAuth.js Docs](https://next-auth.js.org/)
- [Authentication Guide](https://nextjs.org/docs/app/guides/authentication)
- [NextAuth.js Configuration](https://next-auth.js.org/configuration/nextjs)

### Performance

- [Font Optimization](https://nextjs.org/docs/app/getting-started/fonts)
- [Image Optimization](https://nextjs.org/docs/app/getting-started/images)
- [Optimizing Guide](https://nextjs.org/docs/app/building-your-application/optimizing/images)

### Deployment

- [Vercel Deployment](https://vercel.com/docs)
- [ISR Guide](https://nextjs.org/docs/app/guides/incremental-static-regeneration)
- [Edge Functions](https://vercel.com/docs/edge-functions)

### Community Resources

- [Next.js GitHub Discussions](https://github.com/vercel/next.js/discussions)
- [Dev.to Next.js Articles](https://dev.to/search?q=next.js)
- [Next.js Discord Community](https://discord.gg/nextjs)

---

## Summary of Key Takeaways

1. **Default to Server Components** - They reduce JavaScript and improve
   performance
2. **Use ISR for most content** - Perfect balance between static and dynamic
3. **Optimize images and fonts** - Biggest performance wins are from media
4. **Middleware for global logic** - Auth, redirects, headers at the edge
5. **Server Actions for mutations** - Safer than separate API routes
6. **Streaming with Suspense** - Progressive rendering improves UX
7. **Tag-based revalidation** - More flexible than time-based alone
8. **Security first** - Store secrets server-side, use HttpOnly cookies
9. **Monitor bundle size** - Keep client-side JS minimal
10. **Test in production-like env** - Use preview deployments

---

**Document Version:** 1.0 **Last Updated:** December 2025 **Next.js Version:**
15+ **Maintained by:** Spike Land Development Team
