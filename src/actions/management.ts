"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { managementSchema } from "@/lib/validations/management";

async function client() {
  const db=await createClient();
  const {data:{user}}=await db.auth.getUser();
  if(!user) throw new Error("Silakan masuk kembali.");
  const {data}=await db.from("admins").select("id").eq("id",user.id).single();
  if(!data) throw new Error("Akses ditolak.");
  return db;
}
export async function manage(input: unknown, fileData?: FormData) {
  let uploaded: string|undefined;
  try {
    const v=managementSchema.parse(input); const db=await client();
    let foto: string|undefined;
    const file=fileData?.get("foto");
    if(file instanceof File && file.size) {
      if(v.entity!=="candidates" || file.size>5*1024*1024 || !["image/jpeg","image/png","image/webp"].includes(file.type)) throw new Error("Foto harus JPEG, PNG, atau WebP, maksimal 5 MB.");
      const bytes=new Uint8Array(await file.arrayBuffer());
      const valid=(file.type==="image/jpeg" && bytes[0]===255 && bytes[1]===216) || (file.type==="image/png" && bytes[0]===137 && bytes[1]===80 && bytes[2]===78 && bytes[3]===71) || (file.type==="image/webp" && new TextDecoder().decode(bytes.slice(8,12))==="WEBP");
      if(!valid) throw new Error("Isi file bukan foto yang valid.");
      const storage=createAdminClient().storage.from("candidate-photos");
      const path=crypto.randomUUID();
      const {error}=await storage.upload(path,bytes,{contentType:file.type});
      if(error) throw new Error("Unggah foto gagal. Periksa bucket Storage.");
      uploaded=path; foto=storage.getPublicUrl(path).data.publicUrl;
    }
    const payload=v.entity==="elections" ? {nama:v.nama,periode_mulai:v.mulai ? new Date(v.mulai+"T00:00:00+07:00").toISOString():null,periode_selesai:v.selesai ? new Date(v.selesai+"T00:00:00+07:00").toISOString():null} : v.entity==="positions" ? {nama_jabatan:v.nama,election_id:z.string().uuid().parse(v.parent),urutan:v.nomor} : {nama:v.nama,position_id:z.string().uuid().parse(v.parent),no_urut:v.nomor,info:v.info,visi_misi:v.visi_misi,...(foto?{foto}:{})};
    const values: Record<string,string|number|null|undefined> = payload;
    const query=v.id?db.from(v.entity).update(values).eq("id",v.id):db.from(v.entity).insert(values);
    const {error}=await query.select("id").single();
    if(error) throw new Error(error.code==="23505"?"Nomor urut sudah digunakan.":error.message);
    revalidatePath("/admin","layout"); return {ok:true,message:"Data tersimpan."};
  } catch(error) {
    if(uploaded) await createAdminClient().storage.from("candidate-photos").remove([uploaded]);
    return {ok:false,message:error instanceof z.ZodError?"Periksa isian formulir.":error instanceof Error?error.message:"Gagal menyimpan."};
  }
}
export async function change(input: unknown) {
  try {
    const v=z.object({entity:z.enum(["elections","positions","candidates"]),id:z.string().uuid(),status:z.enum(["open","closed"]).optional(),order:z.array(z.string().uuid()).max(1000).optional()}).parse(input);
    const db=await client();
    const result=v.order?await db.rpc("reorder_positions",{p_election:v.id,p_ids:v.order}):v.status?await db.from("elections").update({status:v.status}).eq("id",v.id).select("id").single():await db.from(v.entity).delete().eq("id",v.id).select("id").single();
    if(result.error) throw new Error(result.error.message);
    revalidatePath("/admin","layout"); return {ok:true,message:"Perubahan tersimpan."};
  } catch(e) {return {ok:false,message:e instanceof Error?e.message:"Perubahan gagal."};}
}
