import { Construction } from "lucide-react";
import { notFound } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const sections: Record<string, { title: string; description: string }> = {
  pemilu: { title: "Kelola Pemilu", description: "Pembuatan pemilu, jabatan, dan perubahan status akan hadir pada fase berikutnya." },
  data: { title: "Data DPT", description: "Pengelolaan daftar pemilih dan kode unik akan hadir pada fase berikutnya." },
  kandidat: { title: "Kandidat", description: "Pengelolaan kandidat dan visi-misi akan hadir pada fase berikutnya." },
  petugas: { title: "Kelola Petugas", description: "Pengelolaan penempatan petugas akan hadir pada fase berikutnya." },
  hasil: { title: "Hasil Voting", description: "Rekap dan visualisasi hasil voting akan hadir pada fase berikutnya." },
  audit: { title: "Audit Log & Ekspor", description: "Pencarian dan ekspor audit log akan hadir pada fase berikutnya." },
  pengaturan: { title: "Pengaturan Web", description: "Tema, identitas penyelenggara, dan format kode akan hadir pada fase berikutnya." },
};

export default async function AdminPlaceholderPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const content = sections[section];
  if (!content) notFound();

  return <main className="mx-auto grid min-h-[calc(100vh-72px)] max-w-[1440px] place-items-center px-6 py-12 sm:px-10"><Card className="w-full max-w-xl text-center"><CardHeader className="items-center"><span className="mb-4 grid size-11 place-items-center rounded-full bg-panel"><Construction className="size-5" /></span><CardTitle>{content.title}</CardTitle><CardDescription>{content.description}</CardDescription></CardHeader><CardContent className="pt-5 text-sm text-muted-foreground">Halaman ini telah dilindungi akses admin dan siap dikembangkan pada fase terkait.</CardContent></Card></main>;
}
