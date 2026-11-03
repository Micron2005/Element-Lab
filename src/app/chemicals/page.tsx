import ChemicalsTool from "@/components/ChemicalsTool";
import { localizedMetadata } from "@/lib/i18n/server";

export async function generateMetadata() {
  return localizedMetadata("meta.chemicals");
}

export default function ChemicalsPage() {
  return <ChemicalsTool />;
}
