import React from "react";
export const Link = React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>((props, ref) => {
  return <a ref={ref} {...props} />;
});
Link.displayName = "Link";
