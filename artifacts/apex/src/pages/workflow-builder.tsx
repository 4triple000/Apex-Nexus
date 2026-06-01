import { FeaturePreview } from "@/components/ui/FeaturePreview";
import { WorkflowBuilder } from "@/components/workflow-builder";

function WorkflowBuilderInner() {
  return <WorkflowBuilder />;
}

export default function WorkflowBuilderPage() {
  return (
    <FeaturePreview feature="workflows">
      <WorkflowBuilderInner />
    </FeaturePreview>
  );
}
