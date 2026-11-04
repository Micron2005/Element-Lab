import PlayTool from "@/components/PlayTool";
import { localizedMetadata } from "@/lib/i18n/server";

export async function generateMetadata() {
  return localizedMetadata("meta.play");
}

export default function PlayPage() {
  return <PlayTool />;
}
