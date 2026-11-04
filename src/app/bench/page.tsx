import BenchTool from "@/components/BenchTool";
import { localizedMetadata } from "@/lib/i18n/server";

export async function generateMetadata() {
  return localizedMetadata("meta.bench");
}

export default function BenchPage() {
  return <BenchTool />;
}
