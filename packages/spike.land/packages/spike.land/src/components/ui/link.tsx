import NextLink from "next/link";
import { forwardRef } from "react";

type LinkProps = React.ComponentProps<typeof NextLink>;

/**
 * App-wide Link component. Uses standard Next.js Link which automatically
 * participates in view transitions via the ViewTransitions wrapper in the
 * root layout. This avoids the `useSetFinishViewTransition` context error
 * (SPIKE-LAND-NEXTJS-5) and Turbopack SSR module instantiation errors
 * (SPIKE-LAND-NEXTJS-A) that occurred with the next-view-transitions Link.
 */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>((props, ref) => {
  return <NextLink {...props} ref={ref} />;
});

Link.displayName = "Link";
