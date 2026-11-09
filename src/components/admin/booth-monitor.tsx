"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { CircleDot, Monitor, RefreshCw, UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { BoothItem } from "@/lib/validations/staff";

interface BoothMonitorProps {
  initialBooths: BoothItem[];
  electionId?: string;
}

const statusConfig = {
  kosong: { label: "Kosong / Siap", dot: "bg-emerald-600", text: "text-emerald-700 dark:text-emerald-400" },
  terpakai: { label: "Sedang Digunakan", dot: "bg-amber-500 animate-pulse", text: "text-amber-700 dark:text-amber-400" },
  nonaktif: { label: "Nonaktif", dot: "bg-outline", text: "text-muted-foreground" },
};

export function BoothMonitor({ initialBooths, electionId }: BoothMonitorProps) {
  const [booths, setBooths] = useState<BoothItem[]>(initialBooths);
  const [isPending, startTransition] = useTransition();

  const fetchLatestBooths = useCallback(() => {
    if (!electionId) return;
    startTransition(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("booths")
        .select("id, election_id, nama, status, created_at")
        .eq("election_id", electionId)
        .order("nama", { ascending: true });

      if (data) {
        setBooths((prev) => {
          const staffMap = new Map(prev.map((b) => [b.id, b.staff_name]));
          return data.map((b) => ({
            ...b,
            status: b.status as "kosong" | "terpakai" | "nonaktif",
            staff_name: staffMap.get(b.id) ?? null,
          }));
        });
      }
    });
  }, [electionId]);

  // Realtime Supabase Subscription
  useEffect(() => {
    if (!electionId) return;
    const supabase = createClient();

    // 1. Channel for booth broadcast
    const broadcastChannel = supabase.channel("realtime:booth-status");
    broadcastChannel
      .on("broadcast", { event: "booth-status-change" }, () => {
        fetchLatestBooths();
      })
      .subscribe();

    // 2. Channel for votes broadcast (booth-active, booth-idle)
    const votesChannel = supabase.channel("realtime:votes-channel");
    votesChannel
      .on("broadcast", { event: "booth-active" }, (payload) => {
        const activeBoothId = payload.payload?.boothId;
        if (activeBoothId) {
          setBooths((prev) =>
            prev.map((b) =>
              b.id === activeBoothId ? { ...b, status: "terpakai" } : b
            )
          );
        } else {
          fetchLatestBooths();
        }
      })
      .on("broadcast", { event: "booth-idle" }, () => {
        fetchLatestBooths();
      })
      .on("broadcast", { event: "vote-cast" }, () => {
        fetchLatestBooths();
      })
      .subscribe();

    // 3. Postgres changes on booths
    const cdcChannel = supabase.channel("realtime:booths-cdc");
    cdcChannel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booths", filter: `election_id=eq.${electionId}` },
        () => {
          fetchLatestBooths();
        }
      )
      .subscribe();

    // 5s fallback polling
    const interval = setInterval(fetchLatestBooths, 5000);

    return () => {
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(votesChannel);
      supabase.removeChannel(cdcChannel);
      clearInterval(interval);
    };
  }, [electionId, fetchLatestBooths]);

  const total = booths.length;
  const inUse = booths.filter((b) => b.status === "terpakai").length;
  const ready = booths.filter((b) => b.status === "kosong").length;

  return (
    <div className="space-y-4">
      {/* Counters */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center justify-between rounded-2xl bg-panel p-4">
          <span className="flex items-center gap-2 text-xs">
            <CircleDot className="size-3.5 text-emerald-600" /> Siap / Kosong
          </span>
          <span className="text-base font-semibold">{ready}</span>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-panel p-4">
          <span className="flex items-center gap-2 text-xs">
            <UsersRound className="size-3.5 text-amber-500" /> Terpakai
          </span>
          <span className="text-base font-semibold">{inUse}</span>
        </div>
      </div>

      {/* Booths live list */}
      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {total === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Belum ada bilik suara terdaftar untuk pemilu ini.
          </p>
        ) : (
          booths.map((b) => {
            const config = statusConfig[b.status];
            return (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-xl border border-border-soft bg-background/60 p-3 text-xs transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Monitor className="size-3.5 text-muted-foreground" />
                  <span className="font-medium text-foreground">{b.nama}</span>
                  {b.staff_name && (
                    <span className="text-[11px] text-muted-foreground">({b.staff_name})</span>
                  )}
                </div>
                <span className={`flex items-center gap-1.5 font-medium ${config.text}`}>
                  <span className={`size-2 rounded-full ${config.dot}`} />
                  {config.label}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          Realtime aktif
        </span>
        <button
          type="button"
          onClick={fetchLatestBooths}
          disabled={isPending}
          className="hover:text-foreground inline-flex items-center gap-1"
        >
          <RefreshCw className={`size-3 ${isPending ? "animate-spin" : ""}`} /> Segarkan
        </button>
      </div>
    </div>
  );
}
