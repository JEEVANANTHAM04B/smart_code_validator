import { createFileRoute } from "@tanstack/react-router";
import { ValidatorCore } from "@/components/validator-core";

export const Route = createFileRoute("/validator")({
  head: () => ({
    meta: [
      { title: "Code Validator | Smart Code Validator" },
      {
        name: "description",
        content:
          "Submit a Python or SQL solution and get an AI code review with scores, complexity analysis, difficulty estimation and optimized rewrites.",
      },
      { property: "og:title", content: "Code Validator | Smart Code Validator" },
      {
        property: "og:description",
        content: "AI code review with scoring, complexity analysis and optimized solutions.",
      },
    ],
  }),
  component: ValidatorPage,
});

function ValidatorPage() {
  return <ValidatorCore />;
}

