import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";

import { notifyNavigation, portableDocumentHref } from "./navigation";

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  children?: ReactNode;
};

export default function Link({ href, onClick, target, ...props }: LinkProps) {
  const documentHref = portableDocumentHref(href);
  const clicked = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      target === "_blank" ||
      !href.startsWith("/") ||
      documentHref
    )
      return;
    event.preventDefault();
    window.history.pushState(null, "", href);
    notifyNavigation();
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  return (
    <a
      {...props}
      href={documentHref ?? href}
      onClick={clicked}
      target={target}
    />
  );
}
