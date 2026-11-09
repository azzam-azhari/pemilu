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
  const { elections, booths, staff, electionId: activeElectionId } = await getStaffAndBooths(electionId);

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-12 sm:px-10">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Kelola Petugas & Bilik
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          Petugas & Penempatan Bilik
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pencatatan data petugas pemilu dan penempatan bilik suara fisik di lokasi pemilihan.
        </p>
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

