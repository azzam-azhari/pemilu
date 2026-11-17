import { z } from "zod";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { Booth } from "@/components/booth";
import { Card } from "@/components/ui/card";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{bilik?:string}>}) {
  const params=await searchParams;
  let name="Bilik Suara";let booth:string|null=null;let error="";
  if(params.bilik!==undefined) {
    const id=z.string().uuid().safeParse(params.bilik);
    if(!id.success)error="Alamat bilik tidak valid. Hubungi petugas.";
    else {
      booth=id.data;
      const {data,error:dbError}=await createAdminClient().from("booths").select("nama,status").eq("id",booth).maybeSingle();
      if(dbError||!data||data.status==="nonaktif")error="Bilik tidak tersedia. Hubungi petugas.";
      else name=data.nama;
    }
  }
  const hasSession=Boolean((await cookies()).get("pemilu-voter")?.value);
  return (
    <main className="relative h-dvh overflow-hidden bg-background">
      {error ? (
        <div className="grid h-full place-items-center px-4">
          <Card className="w-full max-w-xl p-8">
            <h1 className="text-2xl">Konfigurasi bilik</h1>
            <p role="alert" className="text-muted-foreground">{error}</p>
          </Card>
        </div>
      ) : (
        <Booth booth={booth} name={name} hasSession={hasSession} />
      )}
    </main>
  );
}
