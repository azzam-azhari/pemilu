"use server";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { voterSchema, parseCsv, csvCell } from "@/lib/dpt";

async function context() {
  const db=await createClient();
  const {data:{user},error}=await db.auth.getUser();
  if(error || !user)throw new Error("Silakan masuk kembali.");
  const {data:admin}=await db.from("admins").select("id").eq("id",user.id).single();
  if(!admin)throw new Error("Akses ditolak.");
  return {db:createAdminClient(),actor:user.id};
}
async function codeSettings(db:ReturnType<typeof createAdminClient>) {
  const {data,error}=await db.from("settings").select("value").eq("key","kode_unik").maybeSingle();
  if(error)throw new Error("Pengaturan kode tidak dapat dimuat.");
  return z.object({panjang:z.number().int().min(6).max(64),format:z.enum(["numeric","alphanumeric"])}).parse(data?.value??{panjang:12,format:"alphanumeric"});
}
async function write(ctx:Awaited<ReturnType<typeof context>>, election:string, action:string,id:string|undefined,data:Record<string,string>, settings?:Awaited<ReturnType<typeof codeSettings>>) {
  for(let attempt=0;attempt<8;attempt++) {
    const payload={...data};
    if(settings) {
      const alphabet=settings.format==="numeric"?"0123456789":"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      payload.kode=Array.from({length:settings.panjang},()=>alphabet[randomInt(alphabet.length)]).join("");
    }
    const {error}=await ctx.db.rpc("manage_voter",{p_actor:ctx.actor,p_election:election,p_action:action,p_id:id??null,p_data:payload});
    if(!error)return;
    if(error.code==="23505" && settings)continue;
    throw new Error(error.message);
  }
  throw new Error("Kode unik gagal dibuat. Coba lagi atau tambah panjang kode.");
}
export async function mutateVoter(input:unknown) {
  try {
    const v=z.object({action:z.enum(["create","edit","delete","reset"]),election:z.string().uuid(),id:z.string().uuid().optional(),nama:z.string().optional(),kelompok:z.string().optional()}).parse(input);
    if(v.action!=="create" && !v.id)throw new Error("Pemilih wajib dipilih.");
    const data=v.action==="create"||v.action==="edit"?voterSchema.parse(v):{};
    const ctx=await context();
    await write(ctx,v.election,v.action,v.id,data,v.action==="create"||v.action==="reset"?await codeSettings(ctx.db):undefined);
    revalidatePath("/admin","layout");
    return {ok:true,message:"Data pemilih tersimpan."};
  } catch(e) {return {ok:false,message:e instanceof z.ZodError?"Periksa nama dan kelompok.":e instanceof Error?e.message:"Gagal memproses data."};}
}
export async function importVoters(election: string, form:FormData) {
  const failures:{line:number;message:string}[]=[];let inserted=0;
  try {
    z.string().uuid().parse(election);const ctx=await context();
    const file=form.get("file");
    if(!(file instanceof File)||file.size>2*1024*1024)throw new Error("Pilih CSV maksimal 2 MB.");
    const rows=parseCsv(await file.text());const header=rows.shift()?.cells.map(c=>c.trim().toLowerCase());
    if(!header || header.join(",")!=="nama,kelompok")throw new Error("Header CSV harus nama,kelompok.");
    if(rows.length>5000)throw new Error("Maksimal 5.000 baris per impor.");
    const settings=await codeSettings(ctx.db);
    // Bounded concurrency keeps 1,000-row imports practical without flooding PostgREST.
    for(let offset=0;offset<rows.length;offset+=10) {
      await Promise.all(rows.slice(offset,offset+10).map(async row=>{
      const parsed=voterSchema.safeParse({nama:row.cells[0],kelompok:row.cells[1]??""});
      if(row.cells.length!==2 || !parsed.success) {failures.push({line:row.line,message:"Isi nama (2–160 karakter) dan kelompok (maksimal 120 karakter)."});return;}
      try {await write(ctx,election,"create",undefined,parsed.data,settings);inserted++;}
      catch(e){failures.push({line:row.line,message:e instanceof Error?e.message:"Gagal menyimpan"});}
      }));
    }
    failures.sort((a,b)=>a.line-b.line);
    revalidatePath("/admin","layout");
    return {ok:true,message:inserted+" baris berhasil; "+failures.length+" baris gagal.",failures};
  } catch(e){return {ok:false,message:e instanceof Error?e.message:"Impor gagal.",failures};}
}
export async function exportVoters(election:string) {
  z.string().uuid().parse(election);const ctx=await context();
  const rows:string[]=["nama,kelompok,kode_unik,status,waktu_memilih"];
  for(let offset=0;;offset+=1000) {
    const {data,error}=await ctx.db.from("voters").select("nama,kelompok,kode_unik,has_voted,voted_at").eq("election_id",election).order("id").range(offset,offset+999);
    if(error)throw new Error("Ekspor gagal.");
    for(const r of data)rows.push([r.nama,r.kelompok,r.kode_unik,r.has_voted?"Sudah Memilih":"Belum Memilih",r.voted_at].map(csvCell).join(","));
    if(data.length<1000)break;
  }
  const {error}=await ctx.db.from("audit_logs").insert({aksi:"dpt_export",aktor:ctx.actor,detail:{election_id:election,jumlah:rows.length-1}});
  if(error)throw new Error("Audit ekspor gagal.");
  return "\uFEFF"+rows.join("\r\n");
}
