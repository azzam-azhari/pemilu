import { getElectionResults, getElectionsList } from "@/actions/results";
import { getWebSettings } from "@/actions/settings";
import { ResultsView } from "@/components/results/results-view";

export const metadata = {
  title: "Hasil Voting — Admin",
  description: "Rekapitulasi dan visualisasi perolehan suara pemilihan.",
};

export default async function AdminHasilPage({
  searchParams,
}: {
  searchParams: Promise<{ election?: string }>;
}) {
  const { election: electionId } = await searchParams;
  const [initialData, elections, webSettings] = await Promise.all([
    getElectionResults(electionId),
    getElectionsList(),
    getWebSettings(),
  ]);

  return (
    <div>
      {elections.length > 1 && (
        <div className="border-b border-border-soft bg-panel/40 px-6 py-2.5 sm:px-10 text-xs flex items-center gap-2">
          <span className="text-muted-foreground font-medium">Pilih Pemilu:</span>
          <div className="flex flex-wrap gap-1.5">
            {elections.map((el) => {
              const isSelected = (electionId ? el.id === electionId : el.id === initialData.election?.id);
              return (
                <a
                  key={el.id}
                  href={`/admin/hasil?election=${el.id}`}
                  className={`rounded-full px-3 py-1 font-medium transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-panel text-muted-foreground hover:text-foreground border border-border-soft"
                  }`}
                >
                  {el.nama} ({el.status})
                </a>
              );
            })}
          </div>
        </div>
      )}
      <ResultsView initialData={initialData} electionId={electionId} webSettings={webSettings} isAdmin={true} />
    </div>
  );
}
