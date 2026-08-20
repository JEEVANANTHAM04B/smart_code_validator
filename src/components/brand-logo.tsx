import React from "react";

export function BrandLogo({ className = "size-8", alt = "Brand Logo", ...props }: React.ComponentProps<"img">) {
  return (
    <img
      src="/brand-logo.png"
      alt={alt}
      className={`object-contain ${className}`}
      {...props}
    />
  );
}



