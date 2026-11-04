import LabTool from "@/components/LabTool";
import { localizedMetadata } from "@/lib/i18n/server";

export async function generateMetadata() {
  return localizedMetadata("meta.lab");
}

export default function LabPage() {
  return <LabTool />;
}
