"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/types";
import { isActive } from "@/lib/navigation";

interface NavProps {
  items: NavItem[];
  label: string;
  orientation?: "horizontal" | "vertical";
}

/** Navegación reutilizable (cabecera y barra lateral). */
export function Nav({ items, label, orientation = "horizontal" }: NavProps) {
  const pathname = usePathname();
  const layout =
    orientation === "vertical" ? "flex-col" : "flex-row overflow-x-auto";
  return (
    <nav aria-label={label}>
      <ul className={`flex gap-1 ${layout}`}>
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-md px-3 py-2 text-sm font-medium ${
                  active
                    ? "bg-brand-700 text-white underline decoration-2 underline-offset-4"
                    : "text-slate-800 hover:bg-brand-100"
                }`}
              >
                {item.label}
                {item.description && orientation === "vertical" ? (
                  <span className="block text-xs font-normal opacity-80">{item.description}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
