import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Manager } from "@/components/admin/management";
export default async function Page({searchParams}:{searchParams:Promise<{jabatan?:string}>}) {
  const db=await createClient(); const q=await searchParams;
  const {data:positions,error}=await db.from("positions").select("*, elections(nama,status)").order("urutan");
  if(error) throw new Error("Tidak dapat memuat jabatan.");
  const selected=positions?.find(p=>p.id===q.jabatan)??positions?.[0];
  const candidates=selected?await db.from("candidates").select("*").eq("position_id",selected.id).order("no_urut"):null;
  if(candidates?.error) throw new Error("Tidak dapat memuat kandidat.");
  return <main className="mx-auto max-w-[1440px] space-y-8 px-6 py-12 sm:px-10"><h1 className="text-3xl">Kandidat</h1><nav className="flex flex-wrap gap-3">{positions?.map(p=><Link className="rounded-full border px-4 py-2" key={p.id} href={"?jabatan="+p.id}>{p.elections.nama} · {p.nama_jabatan}</Link>)}</nav>{selected?<><h2 className="text-2xl">{selected.nama_jabatan}</h2><Manager key={selected.id} entity="candidates" parent={selected.id} rows={candidates?.data??[]} locked={selected.elections.status!=="draft"}/></>:<p>Buat pemilu dan jabatan terlebih dahulu di Kelola Pemilu.</p>}</main>;
}
