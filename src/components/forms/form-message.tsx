import { cn } from "@/lib/utils";

export function FormMessage({
  message,
  status,
}: {
  message?: string;
  status?: "error" | "success";
}) {
  if (!message) return null;
  return (
    <p
      role={status === "error" ? "alert" : "status"}
      className={cn(
        "rounded-md border p-3 text-sm",
        status === "error"
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-border bg-muted",
      )}
    >
      {message}
    </p>
  );
}
