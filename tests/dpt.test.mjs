import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, csvCell, voterSchema, querySchema } from "../src/lib/dpt.ts";
test("CSV: BOM, CRLF, comma, escaped quotes, multiline and physical row numbers",()=>{
  const rows=parseCsv('\uFEFFnama,kelompok\r\n"Alya, B","Kelas ""A"""\r\n"Bima\nSantosa",B\r\n');
  assert.deepEqual(rows,[{line:1,cells:["nama","kelompok"]},{line:2,cells:["Alya, B",'Kelas "A"']},{line:3,cells:["Bima\nSantosa","B"]}]);
});
test("Malformed CSV is rejected before import",()=>{
  assert.throws(()=>parseCsv('nama,kelompok\n"Belum tutup,A'));
  assert.throws(()=>parseCsv('nama,kelompok\n"A"a,B'));
});
test("1,000 valid voter rows survive parsing and Zod validation",()=>{
  const csv="nama,kelompok\n"+Array.from({length:1000},(_,i)=>"Pemilih "+i+",Kelompok A").join("\n");
  const rows=parseCsv(csv).slice(1);
  assert.equal(rows.length,1000);
  for(const row of rows)assert.equal(voterSchema.safeParse({nama:row.cells[0],kelompok:row.cells[1]}).success,true);
});
test("Bad voter fields, unsafe paging and unknown sorts are handled",()=>{
  assert.equal(voterSchema.safeParse({nama:"A"}).success,false);
  const q=querySchema.parse({page:"-1",sort:"secret",size:"9999"});
  assert.equal(q.page,1);assert.equal(q.size,25);assert.equal(q.sort,"nama");
});
test("Exports escape CSV and neutralize formula cells",()=>{
  assert.equal(csvCell('A,"B"'),'"A,""B"""');
  assert.equal(csvCell("=HYPERLINK(1)"),'"\'=HYPERLINK(1)"');
});
