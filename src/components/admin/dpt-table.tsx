"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryStates, parseAsString, parseAsInteger, parseAsStringLiteral } from "nuqs";
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from "@tanstack/react-table";
import { mutateVoter, importVoters, exportVoters } from "@/actions/dpt";
import type { Voter } from "@/lib/dpt";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const field="rounded-input border bg-panel p-3";
export function DptTable({rows,count,elections,election,closed}:{rows:Voter[];count:number;elections:{id:string;nama:string}[];election:string;closed:boolean}) {
  const router=useRouter();const [pending,start]=useTransition();
  const [message,setMessage]=useState("");const [failures,setFailures]=useState<{line:number;message:string}[]>([]);
  const [editing,setEditing]=useState<Voter|null|undefined>();
  const [query,setQuery]=useQueryStates({pemilu:parseAsString.withDefault(election),q:parseAsString.withDefault(""),kelompok:parseAsString.withDefault(""),status:parseAsStringLiteral(["semua","sudah","belum"] as const).withDefault("semua"),sort:parseAsStringLiteral(["nama","kelompok","kode_unik","has_voted","voted_at"] as const).withDefault("nama"),arah:parseAsStringLiteral(["asc","desc"] as const).withDefault("asc"),page:parseAsInteger.withDefault(1),size:parseAsInteger.withDefault(25)},{shallow:false,history:"push"});
  const run=(fn:()=>Promise<void>)=>start(async()=>{try{await fn();}catch{setMessage("Permintaan gagal. Periksa koneksi dan coba lagi.");}});
  const mutate=async(input:unknown)=>{const r=await mutateVoter(input);setMessage(r.message);if(r.ok){setEditing(undefined);router.refresh();}return r;};
  const download=(text:string)=>{const url=URL.createObjectURL(new Blob([text],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="dpt-kode.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const columns:ColumnDef<Voter>[]=[
    {accessorKey:"nama",header:"Nama"},
    {accessorKey:"kelompok",header:"Kelompok",cell:c=>String(c.getValue()??"—")},
    {accessorKey:"kode_unik",header:"Kode unik"},
    {accessorKey:"has_voted",header:"Status",cell:c=><span className="whitespace-nowrap"><span className={c.getValue()?"text-emerald-600":"text-outline"}>● </span>{c.getValue()?"Sudah Memilih":"Belum Memilih"}</span>},
    {accessorKey:"voted_at",header:"Waktu memilih",cell:c=>c.getValue()?new Date(String(c.getValue())).toLocaleString("id-ID",{timeZone:"Asia/Jakarta"})+" WIB":"—"},
    {id:"aksi",header:"Aksi",enableSorting:false,cell:({row})=><div className="flex gap-2"><Button variant="outline" disabled={pending||closed||row.original.has_voted} onClick={()=>setEditing(row.original)}>Edit</Button><Button variant="outline" disabled={pending||closed||row.original.has_voted} onClick={()=>{if(confirm("Reset kode "+row.original.nama+"? Kode lama langsung tidak berlaku. Status hak pilih tetap Belum Memilih."))run(async()=>{await mutate({action:"reset",election,id:row.original.id});});}}>Reset kode</Button><Button variant="outline" disabled={pending||closed||row.original.has_voted} onClick={()=>{if(confirm("Hapus pemilih "+row.original.nama+" dari DPT?"))run(async()=>{await mutate({action:"delete",election,id:row.original.id});});}}>Hapus</Button></div>},
  ];
  // TanStack owns the row model; filters, sorting and pagination are performed in Postgres.
  const table=useReactTable({data:rows,columns,getCoreRowModel:getCoreRowModel(),manualSorting:true,manualPagination:true,rowCount:count,state:{sorting:[{id:query.sort,desc:query.arah==="desc"}],pagination:{pageIndex:Math.max(query.page-1,0),pageSize:query.size}}});
  if(!election)return <Card>Belum ada pemilu. Buat pemilu terlebih dahulu.</Card>;
  return <div className="space-y-8">
    <label className="grid gap-2">Pemilu<select className={field} value={election} onChange={e=>{setEditing(undefined);setFailures([]);void setQuery({pemilu:e.target.value,page:1});}}>{elections.map(e=><option key={e.id} value={e.id}>{e.nama}</option>)}</select></label>
    <p role="status" aria-live="polite">{pending?"Memproses…":message}</p>
    <div className="flex flex-wrap gap-3"><Button disabled={pending||closed} onClick={()=>setEditing(null)}>Tambah pemilih</Button><Button variant="outline" disabled={pending} onClick={()=>run(async()=>{download(await exportVoters(election));setMessage("Ekspor seluruh DPT selesai.");})}>Ekspor CSV kode</Button></div>
    <p className="text-sm text-muted-foreground">Kode acak dibuat otomatis saat tambah atau impor. Reset hanya tersedia bagi pemilih yang belum memilih. Pemilih yang sudah memilih dan pemilu Closed dikunci.</p>
    {editing!==undefined&&<Card><h2 className="mb-6 text-xl">{editing?"Edit pemilih":"Tambah pemilih"}</h2><form key={editing?.id??"new"} className="grid gap-4" action={form=>run(async()=>{await mutate({action:editing?"edit":"create",id:editing?.id,election,nama:form.get("nama"),kelompok:form.get("kelompok")});})}><label className="grid gap-2">Nama<input name="nama" required minLength={2} maxLength={160} defaultValue={editing?.nama} className={field}/></label><label className="grid gap-2">Kelompok<input name="kelompok" maxLength={120} defaultValue={editing?.kelompok??""} className={field}/></label><div className="flex gap-3"><Button disabled={pending}>Simpan</Button><Button type="button" variant="outline" onClick={()=>setEditing(undefined)}>Batal</Button></div></form></Card>}
    <Card><h2 className="text-xl">Impor CSV</h2><p className="my-4 text-sm">Header: nama,kelompok. Maksimal 5.000 baris / 2 MB. Baris valid disimpan; baris gagal dilaporkan. Impor ulang menambahkan pemilih baru, jadi unggah ulang hanya baris yang gagal.</p><form className="flex flex-wrap gap-4" action={form=>run(async()=>{const r=await importVoters(election,form);setMessage(r.message);setFailures(r.failures);router.refresh();})}><input aria-label="File CSV DPT" type="file" accept=".csv,text/csv" name="file" required disabled={pending||closed}/><Button disabled={pending||closed}>Impor dan buat kode</Button></form>{failures.length>0&&<div className="mt-4 max-h-64 overflow-auto" role="alert"><ul>{failures.map((f,i)=><li key={i}>Baris {f.line}: {f.message}</li>)}</ul></div>}</Card>
    <Card><div className="mb-6 flex flex-wrap gap-4"><form className="flex flex-wrap gap-3" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void setQuery({q:String(f.get("q")),kelompok:String(f.get("kelompok")),page:1});}}><input key={"q"+query.q} name="q" aria-label="Cari nama" placeholder="Cari nama" defaultValue={query.q} className={field}/><input key={"g"+query.kelompok} name="kelompok" aria-label="Filter kelompok" placeholder="Kelompok" defaultValue={query.kelompok} className={field}/><Button variant="outline">Cari</Button></form><select aria-label="Status memilih" className={field} value={query.status} onChange={e=>void setQuery({status:e.target.value as typeof query.status,page:1})}><option value="semua">Semua status</option><option value="sudah">Sudah Memilih</option><option value="belum">Belum Memilih</option></select></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead>{table.getHeaderGroups().map(group=><tr key={group.id}>{group.headers.map(h=><th key={h.id} className="border-b p-4">{h.column.getCanSort()?<button className="rounded-full px-2 py-1" onClick={()=>void setQuery({sort:h.column.id as typeof query.sort,arah:query.sort===h.column.id&&query.arah==="asc"?"desc":"asc",page:1})}>{flexRender(h.column.columnDef.header,h.getContext())} {query.sort===h.column.id?(query.arah==="asc"?"↑":"↓"):"↕"}</button>:flexRender(h.column.columnDef.header,h.getContext())}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map(row=><tr key={row.id}>{row.getVisibleCells().map(cell=><td className="border-b p-4" key={cell.id}>{flexRender(cell.column.columnDef.cell,cell.getContext())}</td>)}</tr>)}</tbody></table></div>
      {!rows.length&&<p className="py-8">Tidak ada pemilih pada halaman ini.</p>}
      <div className="mt-6 flex flex-wrap items-center gap-3"><span>{count} pemilih · Halaman {query.page}</span><Button variant="outline" disabled={pending||query.page<=1} onClick={()=>void setQuery({page:query.page-1})}>Sebelumnya</Button><Button variant="outline" disabled={pending||query.page*query.size>=count} onClick={()=>void setQuery({page:query.page+1})}>Berikutnya</Button><select aria-label="Jumlah baris" className={field} value={query.size} onChange={e=>void setQuery({size:Number(e.target.value),page:1})}>{[10,25,50,100].map(n=><option key={n} value={n}>{n} per halaman</option>)}</select></div>
    </Card>
  </div>;
}
