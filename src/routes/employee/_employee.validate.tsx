import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/employee/_employee/validate")({
  beforeLoad: () => {
    throw redirect({ to: "/employee/history" });
  },
  component: () => null,
});

