import ElementsTool from "@/components/ElementsTool";
import { localizedMetadata } from "@/lib/i18n/server";

export async function generateMetadata() {
  return localizedMetadata("meta.elements");
}

export default function ElementsPage() {
  return <ElementsTool />;
}
