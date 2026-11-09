import { getElectionResults } from "@/actions/results";
import { getWebSettings } from "@/actions/settings";
import { ResultsView } from "@/components/results/results-view";

export const metadata = {
  title: "Live Preview Hasil Pemilihan",
  description: "Pantau perolehan suara pemilihan umum secara langsung dan transparan.",
};

export default async function LivePreviewPage() {
  const [initialData, webSettings] = await Promise.all([
    getElectionResults(),
    getWebSettings(),
  ]);

  return <ResultsView initialData={initialData} webSettings={webSettings} isAdmin={false} />;
}
