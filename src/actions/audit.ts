"use server";

import { createClient } from "@/lib/supabase/server";
import { auditQuerySchema, type AuditLogItem } from "@/lib/validations/audit";
import { csvCell } from "@/lib/dpt";
import { getElectionResults } from "./results";

async function assertAdmin() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Silakan masuk kembali.");
  const { data: admin } = await db.from("admins").select("id, email").eq("id", user.id).single();
  if (!admin) throw new Error("Akses ditolak.");
  return { db, admin };
}

export async function getAuditLogs(input: unknown) {
  const { db } = await assertAdmin();
  const query = auditQuerySchema.parse(input);

  let builder = db.from("audit_logs").select("id, aksi, aktor, detail, ip, created_at", { count: "exact" });

  if (query.q) {
    builder = builder.or(`aksi.ilike.%${query.q}%,aktor.ilike.%${query.q}%`);
  }
  if (query.aksi && query.aksi !== "semua") {
    builder = builder.eq("aksi", query.aksi);
  }
  if (query.aktor && query.aktor !== "semua") {
    builder = builder.eq("aktor", query.aktor);
  }
  if (query.dari) {
    builder = builder.gte("created_at", new Date(query.dari + "T00:00:00+07:00").toISOString());
  }
  if (query.sampai) {
    builder = builder.lte("created_at", new Date(query.sampai + "T23:59:59+07:00").toISOString());
  }

  builder = builder
    .order(query.sort, { ascending: query.arah === "asc" })
    .range((query.page - 1) * query.size, query.page * query.size - 1);

  const { data, count, error } = await builder;
  if (error) throw new Error(error.message);

  // Distinct actions for filter dropdown
  const { data: distinctActions } = await db
    .from("audit_logs")
    .select("aksi")
    .limit(100);

  const actionsList = Array.from(new Set((distinctActions ?? []).map((a) => a.aksi))).sort();

  return {
    rows: (data ?? []) as AuditLogItem[],
    count: count ?? 0,
    actionsList,
  };
}

export async function exportAuditLogs(input: unknown, format: "csv" | "excel" = "csv") {
  const { db } = await assertAdmin();
  const query = auditQuerySchema.parse(input);

  let builder = db.from("audit_logs").select("id, aksi, aktor, detail, ip, created_at");

  if (query.q) {
    builder = builder.or(`aksi.ilike.%${query.q}%,aktor.ilike.%${query.q}%`);
  }
  if (query.aksi && query.aksi !== "semua") {
    builder = builder.eq("aksi", query.aksi);
  }
  if (query.dari) {
    builder = builder.gte("created_at", new Date(query.dari + "T00:00:00+07:00").toISOString());
  }
  if (query.sampai) {
    builder = builder.lte("created_at", new Date(query.sampai + "T23:59:59+07:00").toISOString());
  }

  builder = builder.order("created_at", { ascending: false }).limit(5000);
  const { data } = await builder;
  const rows = (data ?? []) as AuditLogItem[];

  if (format === "excel") {
    // Generate clean HTML table spreadsheet that Excel opens natively
    let html = `<html><head><meta charset="UTF-8"></head><body>`;
    html += `<table border="1">`;
    html += `<thead><tr style="background:#f3f2ef;font-weight:bold;"><th>ID</th><th>Waktu (WIB)</th><th>Aksi</th><th>Aktor</th><th>IP Address</th><th>Detail</th></tr></thead><tbody>`;
    for (const r of rows) {
      const time = new Date(r.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
      const detailStr = JSON.stringify(r.detail ?? {}).replaceAll("<", "&lt;").replaceAll(">", "&gt;");
      html += `<tr><td>${r.id}</td><td>${time}</td><td>${r.aksi}</td><td>${r.aktor}</td><td>${r.ip ?? "—"}</td><td>${detailStr}</td></tr>`;
    }
    html += `</tbody></table></body></html>`;
    return html;
  }

  // CSV format with UTF-8 BOM
  let csv = "\uFEFFID,Waktu (WIB),Aksi,Aktor,IP,Detail\r\n";
  for (const r of rows) {
    const time = new Date(r.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    const detailStr = JSON.stringify(r.detail ?? {});
    csv += [
      csvCell(r.id),
      csvCell(time),
      csvCell(r.aksi),
      csvCell(r.aktor),
      csvCell(r.ip ?? "—"),
      csvCell(detailStr),
    ].join(",") + "\r\n";
  }
  return csv;
}

export async function exportElectionResults(electionId: string, format: "csv" | "excel" = "csv") {
  await assertAdmin();
  const res = await getElectionResults(electionId);
  if (!res.ok || !res.election || !res.summary || !res.positions) {
    throw new Error("Data hasil pemilihan tidak tersedia.");
  }

  const { election, summary, positions } = res;

  if (format === "excel") {
    let html = `<html><head><meta charset="UTF-8"></head><body>`;
    html += `<h2>LAPORAN RESMI HASIL PEMILIHAN</h2>`;
    html += `<p><strong>Nama Pemilu:</strong> ${election.nama}<br>`;
    html += `<strong>Status:</strong> ${election.status.toUpperCase()} (${summary.is_final ? "HASIL FINAL" : "HASIL SEMENTARA"})<br>`;
    html += `<strong>Partisipasi:</strong> ${summary.total_voted} dari ${summary.total_dpt} DPT (${summary.participation_percentage}%)<br>`;
    html += `<strong>Total Suara Masuk:</strong> ${summary.total_votes_cast} suara<br>`;
    html += `<strong>Integritas Rekonsiliasi:</strong> ${summary.reconciliation_ok ? "100% Cocok" : "Selisih Terdeteksi"}</p>`;

    for (const pos of positions) {
      html += `<h3>Jabatan: ${pos.nama} (Total Suara: ${pos.total_votes})</h3>`;
      html += `<table border="1"><thead><tr style="background:#f3f2ef;"><th>No Urut</th><th>Nama Kandidat</th><th>Jumlah Suara</th><th>Persentase</th><th>Status</th></tr></thead><tbody>`;
      for (const cand of pos.candidates) {
        html += `<tr><td>${cand.nomor}</td><td>${cand.nama}</td><td>${cand.votes}</td><td>${cand.percentage}%</td><td>${cand.is_highest ? "Suara Terbanyak" : "—"}</td></tr>`;
      }
      html += `</tbody></table><br>`;
    }
    html += `</body></html>`;
    return html;
  }

  // CSV format with UTF-8 BOM
  let csv = `\uFEFFLAPORAN HASIL PEMILIHAN - ${election.nama}\r\n`;
  csv += `Status,${election.status.toUpperCase()} (${summary.is_final ? "FINAL" : "SEMENTARA"})\r\n`;
  csv += `Partisipasi,${summary.total_voted} / ${summary.total_dpt} (${summary.participation_percentage}%)\r\n`;
  csv += `Total Suara,${summary.total_votes_cast}\r\n`;
  csv += `Rekonsiliasi,${summary.reconciliation_ok ? "100% Cocok" : "Selisih Terdeteksi"}\r\n\r\n`;

  for (const pos of positions) {
    csv += `Jabatan,${csvCell(pos.nama)},Total Suara,${pos.total_votes}\r\n`;
    csv += `No Urut,Nama Kandidat,Suara,Persentase,Penanda\r\n`;
    for (const c of pos.candidates) {
      csv += `${c.nomor},${csvCell(c.nama)},${c.votes},${c.percentage}%,${c.is_highest ? "Suara Terbanyak" : "—"}\r\n`;
    }
    csv += `\r\n`;
  }
  return csv;
}

