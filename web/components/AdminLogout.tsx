"use client";
import { useRouter } from "next/navigation";

export function AdminLogout() {
  const router = useRouter();
  async function out() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }
  return (
    <button onClick={out} className="btn-ghost !py-2 !px-5 text-[14px]">Sign out</button>
  );
}
