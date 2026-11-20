import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireStaff } from "@/lib/admin/auth";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};

/**
 * Staff only. Everyone else gets a 404 (we don't advertise the area). The
 * database enforces the same rule on every read and action.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireStaff();
  return <div className="mx-auto w-full max-w-5xl px-4 py-8">{children}</div>;
}
