import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Manager } from "@/components/admin/management";
export default async function Page({searchParams}:{searchParams:Promise<{pemilu?:string}>}) {
  const db=await createClient();const q=await searchParams;
  const {data,error}=await db.from("elections").select("*").order("created_at",{ascending:false});
  if(error) throw new Error("Tidak dapat memuat pemilu.");
  const selected=data?.find(e=>e.id===q.pemilu)??data?.[0];
  const positions=selected?await db.from("positions").select("*").eq("election_id",selected.id).order("urutan"):null;
  if(positions?.error) throw new Error("Tidak dapat memuat jabatan.");
  return <main className="mx-auto max-w-[1440px] space-y-12 px-6 py-12 sm:px-10"><h1 className="text-3xl">Kelola Pemilu</h1><Manager entity="elections" rows={data??[]}/><section className="space-y-6"><h2 className="text-2xl">Jabatan</h2><nav className="flex flex-wrap gap-4">{data?.map(e=><Link className="rounded-full border px-4 py-2" aria-current={selected?.id===e.id?"page":undefined} key={e.id} href={"?pemilu="+e.id}>{e.nama}</Link>)}</nav>{selected&&<><p>Jabatan: {selected.nama}. Seret tombol ↕ atau gunakan keyboard untuk mengurutkan.</p><Manager key={selected.id} entity="positions" parent={selected.id} rows={positions?.data??[]} locked={selected.status!=="draft"}/></>}</section></main>;
}
