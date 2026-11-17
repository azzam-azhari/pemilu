import Link from "next/link";
import { getElectionResults, getElectionsList } from "@/actions/results";
import { getWebSettings } from "@/actions/settings";
import { ResultsView } from "@/components/results/results-view";
import { Button } from "@/components/ui/button";

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
    <main className="w-full min-w-0 flex-1 space-y-3 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Laporan Pemungutan Suara
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Hasil Voting & Perolehan Suara
          </h1>
        </div>

        {elections.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-medium text-muted-foreground shrink-0">Pemilu:</span>
            {elections.map((el) => {
              const isSelected = electionId
                ? el.id === electionId
                : el.id === initialData.election?.id;
              return (
                <Button
                  key={el.id}
                  asChild
                  size="sm"
                  variant={isSelected ? "default" : "outline"}
                  className="h-7 text-xs px-2.5 font-normal rounded-full shrink-0"
                >
                  <Link href={`/admin/hasil?election=${el.id}`}>
                    {el.nama} ({el.status})
                  </Link>
                </Button>
              );
            })}
          </div>
        )}
      </div>

      <ResultsView
        initialData={initialData}
        electionId={electionId}
        webSettings={webSettings}
        isAdmin={true}
      />
    </main>
  );
}
