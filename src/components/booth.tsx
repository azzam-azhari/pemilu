"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { castBooth,leaveBooth,readBooth,startBooth,touchBooth } from "@/actions/booth";
import { reasons,type Position,type SessionResult } from "@/lib/validations/booth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme-toggle";

export function Booth({booth,name,hasSession}:{booth:string|null;name:string;hasSession:boolean}) {
  const [stage,setStage]=useState<"input"|"checking"|"voting"|"success">(hasSession?"checking":"input");
  const [positions,setPositions]=useState<Position[]>([]);
  const [title,setTitle]=useState("");
  const [code,setCode]=useState("");
  const [choices,setChoices]=useState<Record<string,string>>({});
  const [message,setMessage]=useState("");
  const [used,setUsed]=useState(false);
  const [confirm,setConfirm]=useState(false);
  const [vision,setVision]=useState<{nama:string;text:string}|null>(null);
  const [busy,setBusy]=useState(false);
  const [clock,setClock]=useState("—");
  const [remaining,setRemaining]=useState(120);
  const [retry,setRetry]=useState(0);
  const [fullscreen,setFullscreen]=useState(false);
  const deadline=useRef(0);const retryDeadline=useRef(0);const lastTouch=useRef(0);
  const inflight=useRef(false);const generation=useRef(0);const backgroundBusy=useRef(false);
  const clear=useCallback(()=>{
    setCode("");setChoices({});setPositions([]);setTitle("");setConfirm(false);setVision(null);
  },[]);
  const apply=useCallback((result:SessionResult)=>{
    if(!result.ok) {
      setMessage(reasons[result.reason]??"Permintaan tidak dapat diproses.");
      if(["sesi_berakhir","kode_sudah_digunakan","pemilu_belum_dibuka","bilik_tidak_valid","surat_suara_tidak_tersedia"].includes(result.reason)) {
        generation.current++;clear();setStage("input");
        if(result.reason==="kode_sudah_digunakan")setUsed(true);
      }
      return;
    }
    if(result.state==="submitted") {generation.current++;clear();setMessage("");setStage("success");return;}
    if(result.state==="active" && result.positions && result.remainingMs!==undefined) {
      if((result.boothId??null)!==booth) {
        clear();setStage("input");setMessage("Sesi berasal dari bilik lain. Masukkan kode kembali.");return;
      }
      deadline.current=Date.now()+result.remainingMs;
      setRemaining(Math.ceil(result.remainingMs/1000));setPositions(result.positions);
      setTitle(result.electionName??"Pemilihan");setStage("voting");setCode("");setMessage("");
    }
  },[booth,clear]);
  const request=useCallback(async(fn:()=>Promise<SessionResult>)=>{
    if(inflight.current)return;
    inflight.current=true;setBusy(true);const current=++generation.current;
    try {const result=await fn();if(generation.current===current)apply(result);}
    catch {if(generation.current===current)setMessage(reasons.layanan_tidak_tersedia);}
    finally {inflight.current=false;setBusy(false);}
  },[apply]);
  const background=useCallback(async(fn:()=>Promise<SessionResult>)=>{
    if(inflight.current||backgroundBusy.current)return;
    backgroundBusy.current=true;const current=generation.current;
    try {const r=await fn();if(current===generation.current&&!inflight.current)apply(r);}
    catch {if(current===generation.current)setMessage(reasons.layanan_tidak_tersedia);}
    finally {backgroundBusy.current=false;}
  },[apply]);
  useEffect(()=>{
    if(!hasSession)return;
    let active=true;
    readBooth().then(r=>{if(active){apply(r);if(!r.ok&&r.reason==="layanan_tidak_tersedia")setStage("input");}}).catch(()=>{if(active){setStage("input");setMessage(reasons.layanan_tidak_tersedia);}});
    return ()=>{active=false;};
  },[hasSession,apply]);
  useEffect(()=>{
    const timer=setInterval(()=>{
      setClock(new Date().toLocaleTimeString("id-ID",{timeZone:"Asia/Jakarta"}));
      setRetry(Math.max(0,Math.ceil((retryDeadline.current-Date.now())/1000)));
      if(stage==="voting")setRemaining(Math.max(0,Math.ceil((deadline.current-Date.now())/1000)));
    },1000);
    return ()=>clearInterval(timer);
  },[stage]);
  useEffect(()=>{
    const change=()=>setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange",change);
    return ()=>document.removeEventListener("fullscreenchange",change);
  },[]);
  useEffect(()=>{
    if(stage!=="voting")return;
    const poll=setInterval(()=>{void background(readBooth);},5000);
    const activity=()=>{
      if(inflight.current || backgroundBusy.current || Date.now()-lastTouch.current<15000)return;
      lastTouch.current=Date.now();void background(touchBooth);
    };
    for(const event of ["pointerdown","keydown","scroll"])window.addEventListener(event,activity,{passive:true});
    return ()=>{clearInterval(poll);for(const event of ["pointerdown","keydown","scroll"])window.removeEventListener(event,activity);};
  },[stage,background]);
  useEffect(()=>{
    if(stage!=="voting"||remaining>0||busy)return;
    // Poll/cast never renews idle. Clear private UI immediately, even when offline.
    const timer=setTimeout(async()=>{
      generation.current++;clear();setStage("checking");setMessage(reasons.sesi_berakhir);
      try {await leaveBooth();} finally {setStage("input");}
    },0);
    return ()=>clearTimeout(timer);
  },[stage,remaining,busy,clear]);
  useEffect(()=>{
    if(stage!=="success")return;
    const timer=setTimeout(async()=>{
      generation.current++;clear();setStage("checking");
      try {await leaveBooth();} finally {setStage("input");}
    },4000);
    return ()=>clearTimeout(timer);
  },[stage,clear]);
  const complete=positions.length>0&&positions.every(p=>p.candidates.some(c=>c.id===choices[p.id]));

  return <div className="relative mx-auto max-w-[1440px] px-6 pb-40 sm:px-10">
    <header className="flex min-h-header flex-wrap items-center justify-between gap-4 border-b border-border-soft py-4">
      <div><p className="text-xs font-medium uppercase tracking-widest">{name}</p><p className="mt-1 text-sm text-muted-foreground">{clock} WIB</p></div>
      <div className="flex gap-3"><ThemeToggle/><Button variant="outline" onClick={async()=>{
        try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
        catch{setMessage("Layar penuh tidak tersedia pada perangkat ini.");}
      }}>{fullscreen?"Keluar layar penuh":"Layar penuh"}</Button>
      {stage==="voting"&&<Button variant="outline" disabled={busy} onClick={()=>void request(async()=>{
        const r=await leaveBooth();if(r.ok){generation.current++;clear();setStage("input");setMessage("");}return r;
      })}>Keluar Sesi</Button>}</div>
    </header>
    {message&&<p role="alert" className="my-6 rounded-input bg-error-container p-4 text-on-error-container">{message}</p>}
    {stage==="checking"&&<p className="py-24 text-center" role="status">Memeriksa sesi…</p>}
    {stage==="input"&&<Card className="mx-auto mt-16 max-w-lg sm:mt-24"><p className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">Selamat datang</p><h1 className="text-3xl font-semibold">Suara Anda berarti.</h1><p className="my-6 text-muted-foreground">Masukkan kode unik dari petugas untuk membuka surat suara.</p>
      <form className="space-y-6" onSubmit={async e=>{
        e.preventDefault();if(busy||retry)return;setUsed(false);
        await request(async()=>{
          const r=await startBooth({code,booth});
          if(r.retryAfter){retryDeadline.current=Date.now()+r.retryAfter*1000;setRetry(r.retryAfter);setMessage("Terlalu banyak percobaan. Tunggu sebelum mencoba kembali.");return {ok:false,reason:"terlalu_banyak_percobaan"};}
          return r;
        });
      }}><label className="grid gap-3 text-sm font-medium">Kode unik<input value={code} onChange={e=>setCode(e.target.value)} name="code" required maxLength={64} autoComplete="off" autoCapitalize="characters" spellCheck={false} className="w-full rounded-input border border-outline-variant bg-panel p-4 text-xl uppercase tracking-widest focus-visible:outline-2 focus-visible:outline-primary"/></label><Button className="w-full" size="lg" disabled={busy||retry>0}>{retry>0?"Coba lagi dalam "+retry+" detik":busy?"Memeriksa…":"Buka Surat Suara"}</Button></form>
    </Card>}
    {stage==="voting"&&<div className="space-y-12 py-12"><div><p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Surat suara</p><h1 className="text-3xl font-semibold">{title}</h1><p className="mt-4">Pilih satu kandidat pada setiap jabatan.</p></div>
      {positions.map(p=><fieldset key={p.id} className="space-y-6"><legend className="mb-6 text-2xl font-medium">{p.nama}</legend><div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{p.candidates.map(c=><Card key={c.id} className={choices[p.id]===c.id?"border-2 border-primary":""}>
        <label className="block cursor-pointer"><input type="radio" name={p.id} value={c.id} checked={choices[p.id]===c.id} disabled={busy} onChange={()=>setChoices(old=>({...old,[p.id]:c.id}))} className="mb-4 size-5 accent-black"/>
        {c.foto&&<CandidatePhoto url={c.foto} name={c.nama}/>}<span className="block text-xs uppercase tracking-widest text-muted-foreground">Nomor {c.nomor}</span><span className="mt-3 block text-2xl font-medium">{c.nama}</span><span className="mt-3 block text-sm text-muted-foreground">{c.info}</span><span className="mt-4 block text-sm">{choices[p.id]===c.id?"✓ Pilihan Anda":"Pilih kandidat"}</span></label>
        <Button variant="outline" className="mt-6" onClick={()=>setVision({nama:c.nama,text:c.visi_misi??"Visi dan misi belum tersedia."})}>Lihat Visi & Misi</Button>
      </Card>)}</div></fieldset>)}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border-soft bg-background/90 p-6 backdrop-blur-[20px]"><div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4"><div><p>{positions.filter(p=>choices[p.id]).length} dari {positions.length} jabatan dipilih</p><p className="text-sm text-muted-foreground">{remaining<=30?"Sesi akan berakhir. Berinteraksilah untuk melanjutkan.":"Pilihan Anda bersifat rahasia."}</p></div><Button disabled={!complete||busy} onClick={()=>setConfirm(true)}>Konfirmasi & Simpan</Button></div></div>
    </div>}
    {stage==="success"&&<Card className="mx-auto mt-24 max-w-lg text-center"><h1 className="text-3xl">Terima kasih!</h1><p role="status" className="mt-6">Suara Anda berhasil disimpan. Bilik kembali siap dalam 4 detik.</p></Card>}
    <Modal open={used} onOpenChange={setUsed} title="Hak Suara Sudah Digunakan"><p>Kode ini sudah dipakai. Suara yang tersimpan tidak dapat diubah. Hubungi petugas bila memerlukan bantuan.</p></Modal>
    <Modal open={Boolean(vision)} onOpenChange={()=>setVision(null)} title={vision?.nama??"Visi & Misi"}><p className="whitespace-pre-wrap">{vision?.text}</p></Modal>
    <Modal open={confirm} onOpenChange={setConfirm} title="Konfirmasi pilihan Anda" locked={busy}>
      <ul className="space-y-4">{positions.map(p=><li key={p.id}><p className="text-sm text-muted-foreground">{p.nama}</p><p className="font-medium">{p.candidates.find(c=>c.id===choices[p.id])?.nama}</p></li>)}</ul><p className="my-6 text-sm">Pilihan tidak dapat diubah setelah disimpan.</p>
      <div className="flex flex-wrap gap-3"><Button disabled={busy||!complete} onClick={()=>void request(()=>castBooth(positions.map(p=>({position_id:p.id,candidate_id:choices[p.id]}))))}>{busy?"Menyimpan…":"Ya, Simpan Pilihan Saya"}</Button><Button variant="outline" disabled={busy} onClick={()=>setConfirm(false)}>Ganti Pilihan</Button></div>
      {message&&<p role="alert" className="mt-4">{message}</p>}
    </Modal>
  </div>;
}
function CandidatePhoto({url,name}:{url:string;name:string}) {
  const [failed,setFailed]=useState(false);
  if(failed)return <div className="mb-6 grid aspect-square place-items-center rounded-lg bg-panel text-muted-foreground">Foto tidak tersedia</div>;
  // Public Supabase URLs are supplied by the server; retain a graceful fallback.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={"Foto "+name} onError={()=>setFailed(true)} className="mb-6 aspect-square w-full rounded-lg object-cover"/>;
}
