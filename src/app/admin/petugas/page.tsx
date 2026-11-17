import { getStaffAndBooths } from "@/actions/staff";
import { StaffManager } from "@/components/admin/staff-manager";

export const metadata = {
  title: "Kelola Petugas & Bilik — Admin",
  description: "Manajemen data petugas dan penempatan bilik suara.",
};

export default async function AdminPetugasPage({
  searchParams,
}: {
  searchParams: Promise<{ election?: string }>;
}) {
  const { election: electionId } = await searchParams;
  const { elections, booths, staff, electionId: activeElectionId } =
    await getStaffAndBooths(electionId);

  return (
    <main className="w-full min-w-0 flex-1 space-y-4 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Operasional TPS
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Kelola Petugas & Bilik
          </h1>
        </div>
      </div>

      <StaffManager
        elections={elections}
        booths={booths}
        staff={staff}
        currentElectionId={activeElectionId}
      />
    </main>
  );
}
