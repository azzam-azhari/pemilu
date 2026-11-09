import { z } from "zod";

export const voterSchema = z.object({
  nama: z.string().trim().min(2, "Nama minimal 2 karakter").max(160),
  kelompok: z.string().trim().max(120).default(""),
});
export const querySchema = z.object({
  pemilu: z.string().uuid().optional(),
  q: z.string().max(160).catch(""),
  kelompok: z.string().max(120).catch(""),
  status: z.enum(["semua", "sudah", "belum"]).catch("semua"),
  sort: z.enum(["nama", "kelompok", "kode_unik", "has_voted", "voted_at"]).catch("nama"),
  arah: z.enum(["asc", "desc"]).catch("asc"),
  page: z.coerce.number().int().min(1).max(100000).catch(1),
  size: z.coerce.number().refine(n => [10,25,50,100].includes(n)).catch(25),
});
export type Voter = { id:string; nama:string; kelompok:string|null; kode_unik:string; has_voted:boolean; voted_at:string|null };

// RFC4180 quoting, BOM, CRLF, embedded newlines and escaped quotes.
export function parseCsv(source: string) {
  const text=source.replace(/^\uFEFF/, "");
  const rows: { line:number; cells:string[] }[]=[];
  let cells:string[]=[], value="", quoted=false, closed=false, line=1, start=1;
  const cell=()=>{cells.push(value);value="";closed=false;};
  const row=()=>{cell();if(cells.some(c=>c.trim()))rows.push({line:start,cells});cells=[];};
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(quoted) {
      if(c==='"') {if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}
      else {value+=c;if(c==="\n")line++;}
    } else if(c==='"') {
      if(value || closed) throw new Error("Tanda kutip tidak valid pada baris "+line);
      quoted=true;
    } else if(c===",") cell();
    else if(c==="\n" || c==="\r") {
      if(c==="\r" && text[i+1]==="\n")i++;
      row();line++;start=line;
    } else {
      if(closed) throw new Error("Karakter setelah kutip pada baris "+line);
      value+=c;
    }
  }
  if(quoted)throw new Error("Kutip CSV belum ditutup pada baris "+start);
  if(value || cells.length || closed)row();
  return rows;
}
export function csvCell(value: unknown) {
  let text=String(value??"");
  if(/^[\s]*[=+@-]/.test(text))text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}
