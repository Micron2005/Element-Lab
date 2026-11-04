import PlayTool from "@/components/PlayTool";
import { localizedMetadata } from "@/lib/i18n/server";
import { Suspense } from "react";

export async function generateMetadata() {
  return localizedMetadata("meta.play");
}

export default function PlayPage() {
  return <Suspense fallback={null}><PlayTool /></Suspense>;
}
