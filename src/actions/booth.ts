"use server";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { cookies,headers } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { choicesSchema,codeSchema,tokenSchema,sessionSchema,type SessionResult } from "@/lib/validations/booth";

const sessionName="pemilu-voter";
const cookieOptions={httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict" as const,path:"/bilik"};
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
async function token() {return tokenSchema.safeParse((await cookies()).get(sessionName)?.value);}
async function rpcSession(action:"read"|"touch"|"cast"|"leave",choices?:z.infer<typeof choicesSchema>):Promise<SessionResult> {
  const t=await token();
  if(!t.success)return {ok:false,reason:"sesi_berakhir"};
  const {data,error}=await createAdminClient().rpc("use_voting_session",{p_hash:hash(t.data),p_action:action,p_choices:choices??null});
  if(error)throw new Error("Session RPC failed");
  return sessionSchema.parse(data);
}
export async function startBooth(input:unknown):Promise<SessionResult & {retryAfter?:number}> {
  try {
    const jar=await cookies();const requestHeaders=await headers();
    let device=jar.get("pemilu-device")?.value;
    if(!tokenSchema.safeParse(device).success) {
      device=randomBytes(32).toString("hex");
      jar.set("pemilu-device",device,{...cookieOptions,maxAge:86400});
    }
    // Trust forwarded IP only on Vercel, which overwrites this header.
    const forwarded=requestHeaders.get("x-forwarded-for");
    const ip=process.env.VERCEL==="1"?(forwarded?forwarded.split(",")[0].trim():undefined):"127.0.0.1";
    if(process.env.NODE_ENV==="production" && process.env.VERCEL!=="1")throw new Error("Untrusted deployment");
    if(!ip || !isIP(ip))throw new Error("Missing trusted IP");
    const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!key)throw new Error("Missing server configuration");
    const db=createAdminClient();
    const {data:retry,error:limitError}=await db.rpc("booth_attempt",{p_device:hash(device!),p_ip:createHmac("sha256",key).update(ip).digest("hex")});
    if(limitError || typeof retry!=="number")throw new Error("Rate limiter unavailable");
    if(retry>0)return {ok:false,reason:"terlalu_banyak_percobaan",retryAfter:retry};
    // Charge attempts before validating even malformed input.
    const parsed=z.object({code:codeSchema,booth:z.string().uuid().nullable()}).safeParse(input);
    if(!parsed.success)return {ok:false,reason:"kode_tidak_valid"};
    const old=await token();
    if(old.success) {
      const result=await rpcSession("leave");
      if(!result.ok && result.reason!=="sesi_berakhir")throw new Error("Cannot replace session");
    }
    const secret=randomBytes(32).toString("hex");
    const {data,error}=await db.rpc("start_voting_session",{p_hash:hash(secret),p_code:parsed.data.code,p_booth:parsed.data.booth});
    if(error)throw new Error("Verification unavailable");
    if(!data?.ok)return sessionSchema.parse(data);
    jar.set(sessionName,secret,{...cookieOptions,maxAge:600});

    // Broadcast booth-active so /live and admin update realtime when code is entered
    try {
      const channel=db.channel("realtime:votes-channel");
      await channel.send({
        type:"broadcast",
        event:"booth-active",
        payload:{boothId:parsed.data.booth,timestamp:Date.now()}
      });
      db.removeChannel(channel);
    } catch {}

    return await rpcSession("read");
  } catch {return {ok:false,reason:"layanan_tidak_tersedia"};}
}
export async function readBooth():Promise<SessionResult> {
  try{return await rpcSession("read");}catch{return {ok:false,reason:"layanan_tidak_tersedia"};}
}
export async function touchBooth():Promise<SessionResult> {
  try{return await rpcSession("touch");}catch{return {ok:false,reason:"layanan_tidak_tersedia"};}
}
export async function castBooth(input:unknown):Promise<SessionResult> {
  const parsed=choicesSchema.safeParse(input);
  if(!parsed.success)return {ok:false,reason:"pilihan_tidak_valid"};
  try{
    const res=await rpcSession("cast",parsed.data);
    if(res.ok && res.state==="submitted") {
      try {
        const adminDb=createAdminClient();
        const channel=adminDb.channel("realtime:votes-channel");
        await channel.send({
          type:"broadcast",
          event:"vote-cast",
          payload:{timestamp:Date.now()}
        });
        await channel.send({
          type:"broadcast",
          event:"booth-idle",
          payload:{timestamp:Date.now()}
        });
        adminDb.removeChannel(channel);
      }catch{}
    }
    return res;
  }catch{return {ok:false,reason:"layanan_tidak_tersedia"};}
}
export async function leaveBooth():Promise<SessionResult> {
  try {
    const result=await rpcSession("leave");
    if(!result.ok && result.reason!=="sesi_berakhir")return result;
    (await cookies()).set(sessionName,"",{...cookieOptions,maxAge:0});
    try {
      const adminDb=createAdminClient();
      const channel=adminDb.channel("realtime:votes-channel");
      await channel.send({
        type:"broadcast",
        event:"booth-idle",
        payload:{timestamp:Date.now()}
      });
      adminDb.removeChannel(channel);
    }catch{}
    return {ok:true,state:"left"};
  }catch{return {ok:false,reason:"layanan_tidak_tersedia"};}
}
