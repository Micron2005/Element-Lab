import AssistantTool from "@/components/AssistantTool";
import { localizedMetadata } from "@/lib/i18n/server";

export async function generateMetadata() {
  return localizedMetadata("meta.assistant");
}

export default function AssistantPage() {
  return <AssistantTool />;
}
