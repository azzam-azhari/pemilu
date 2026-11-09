import { NuqsAdapter } from "nuqs/adapters/next/app";
import { createClient } from "@/lib/supabase/server";
import { querySchema, type Voter } from "@/lib/dpt";
import { DptTable } from "@/components/admin/dpt-table";

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const raw=await searchParams;
  const parsed=querySchema.safeParse(raw);
  if(!parsed.success)throw new Error("Parameter pemilu tidak valid.");
  const q=parsed.data;const db=await createClient();
  const {data:elections,error:ee}=await db.from("elections").select("id,nama,status").order("created_at",{ascending:false});
  if(ee)throw new Error("Daftar pemilu gagal dimuat.");
  const selected=elections?.find(e=>e.id===q.pemilu)??elections?.[0];
  let rows:Voter[]=[];let count=0;
  if(selected) {
    let query=db.from("voters").select("id,nama,kelompok,kode_unik,has_voted,voted_at",{count:"exact"}).eq("election_id",selected.id);
    // Search nama literally; avoid interpolating user input into PostgREST or().
    const literal=(s:string)=>s.replaceAll("\\","\\\\").replaceAll("%","\\%").replaceAll("_","\\_");
    if(q.q)query=query.ilike("nama","%"+literal(q.q)+"%");
    if(q.kelompok)query=query.ilike("kelompok","%"+literal(q.kelompok)+"%");
    if(q.status!=="semua")query=query.eq("has_voted",q.status==="sudah");
    const result=await query.order(q.sort,{ascending:q.arah==="asc",nullsFirst:false}).order("id").range((q.page-1)*q.size,q.page*q.size-1);
    if(result.error)throw new Error("Data pemilih gagal dimuat.");
    rows=result.data??[];count=result.count??0;
  }
  return <main className="mx-auto max-w-[1440px] space-y-8 px-6 py-12 sm:px-10"><h1 className="text-3xl font-semibold">Data Pemilih Tetap</h1><NuqsAdapter><DptTable rows={rows} count={count} elections={elections??[]} election={selected?.id??""} closed={selected?.status==="closed"}/></NuqsAdapter></main>;
}
