import { HypothesisAgent } from "@/lib/agents/hypothesis-agent";
import prisma from "@/lib/prisma";
import { registerStepHandler } from "@/lib/workflows/step-registry";

// Helper to get agent instance (lazy to support mocking)
const getAgent = () => new HypothesisAgent();

/**
 * Helper to get workspaceId from context or config
 */
async function getWorkspaceId(workflowId: string, configWorkspaceId?: string): Promise<string> {
  if (configWorkspaceId) return configWorkspaceId;

  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    select: { workspaceId: true },
  });

  if (!workflow) throw new Error("Workflow not found");
  return workflow.workspaceId;
}

registerStepHandler("generate_hypotheses", async (step, context) => {
  try {
    const workspaceId = await getWorkspaceId(context.workflowId, step.config.workspaceId as string);

    const count = (step.config.count as number) || 3;
    const focus = (step.config.focus as "engagement" | "conversions" | "reach") || "engagement";

    const hypotheses = await getAgent().generateHypotheses({
      workspaceId,
      count,
      focus,
    });

    return {
      output: {
        hypotheses,
        count: hypotheses.length,
        hypothesisIds: hypotheses.map((h) => h.id),
      },
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
});

registerStepHandler("design_experiment", async (step, context) => {
  try {
    const hypothesisId =
      (step.config.hypothesisId as string) || (context.triggerData?.hypothesisId as string); // Allow trigger to pass it

    if (!hypothesisId) return { error: "Hypothesis ID required" };

    const design = await getAgent().designExperiment({
      hypothesisId,
      variants: (step.config.variants as number) || 2,
      primaryMetric: (step.config.primaryMetric as string) || "engagement",
    });

    return { output: { design } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
});

registerStepHandler("generate_variants", async (step, context) => {
  try {
    const hypothesisId =
      (step.config.hypothesisId as string) || (context.triggerData?.hypothesisId as string);

    // Allow getting original content from previous step or config
    const originalContent =
      (step.config.originalContent as string) || (context.triggerData?.originalContent as string);

    if (!hypothesisId || !originalContent) {
      return { error: "Hypothesis ID and Original Content required" };
    }

    const variants = await getAgent().generateVariants({
      hypothesisId,
      originalContent,
      count: (step.config.count as number) || 2,
    });

    return { output: { variants } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
});

registerStepHandler("analyze_results", async (step, context) => {
  try {
    const experimentId =
      (step.config.experimentId as string) || (context.triggerData?.experimentId as string);

    if (!experimentId) return { error: "Experiment ID required" };

    const analysis = await getAgent().analyzeResults({ experimentId });

    return { output: { analysis } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
});

registerStepHandler("select_winner", async (step, context) => {
  try {
    const experimentId =
      (step.config.experimentId as string) || (context.triggerData?.experimentId as string);

    if (!experimentId) return { error: "Experiment ID required" };

    const result = await getAgent().selectWinner({
      experimentId,
      autoPromote: (step.config.autoPromote as boolean) || false,
    });

    return { output: { result } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
});
