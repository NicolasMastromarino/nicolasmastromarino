"use client";

import type { ComponentProps } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { navTypes } from "@/components/nav-types";

type Props = Omit<ComponentProps<typeof Link>, "href" | "transitionTypes"> & { href: string };

/** Internal link that tags its navigation as forward/back for the page transition. */
export function NavLink({ href, ...rest }: Props) {
  const pathname = usePathname();
  return <Link href={href} transitionTypes={navTypes(pathname, href)} {...rest} />;
}
