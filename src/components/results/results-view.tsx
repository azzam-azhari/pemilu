"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Award,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  EyeOff,
  Fullscreen,
  LayoutGrid,
  Minimize,
  Moon,
  Play,
  Pause,
  RefreshCw,
  Sun,
  Users,
  Vote,
  Zap,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getElectionResults } from "@/actions/results";
import { getWebSettings } from "@/actions/settings";
import { createClient } from "@/lib/supabase/client";
import type { ElectionResultsResponse, PositionResult } from "@/lib/validations/results";
import type { WebSettings } from "@/lib/validations/settings";

interface ResultsViewProps {
  initialData: ElectionResultsResponse;
  electionId?: string;
  webSettings?: WebSettings;
  isAdmin?: boolean;
}

const emptySubscribe = () => () => {};

export function ResultsView({ initialData, electionId, webSettings, isAdmin = false }: ResultsViewProps) {
  const [data, setData] = useState<ElectionResultsResponse>(initialData);
  const [settings, setSettings] = useState<WebSettings | undefined>(webSettings);
  const [activePositionId, setActivePositionId] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"card" | "chart">("card");
  const [autoSlide, setAutoSlide] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<"realtime" | "polling">("realtime");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [isPending, startTransition] = useTransition();
  const [boothActiveAlert, setBoothActiveAlert] = useState<boolean>(false);

  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const { theme, setTheme } = useTheme();

  // Sync fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignored if browser blocks fullscreen
    }
  };

  const refreshData = useCallback(() => {
    startTransition(async () => {
      const [res, latestSettings] = await Promise.all([
        getElectionResults(electionId ?? data.election?.id),
        getWebSettings(),
      ]);
      if (res.ok) {
        setData(res);
        setLastRefreshedAt(new Date());
      }
      setSettings(latestSettings);
    });
  }, [electionId, data.election?.id]);

  // Realtime subscription & Fallback polling (5s)
  useEffect(() => {
    const supabase = createClient();

    // 1. Channel for votes and booth events
    const votesChannel = supabase.channel("realtime:votes-channel");
    votesChannel
      .on("broadcast", { event: "booth-active" }, () => {
        setBoothActiveAlert(true);
      })
      .on("broadcast", { event: "booth-idle" }, () => {
        setBoothActiveAlert(false);
      })
      .on("broadcast", { event: "vote-cast" }, () => {
        setBoothActiveAlert(false);
        refreshData();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnectionStatus("realtime");
        } else if (
          status === "TIMED_OUT" ||
          status === "CLOSED" ||
          status === "CHANNEL_ERROR"
        ) {
          setConnectionStatus("polling");
        }
      });

    // 2. Election status changes
    const electionChannel = supabase.channel("realtime:election-status");
    electionChannel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "elections" },
        () => {
          refreshData();
        }
      )
      .subscribe();

    // 3. Settings status changes
    const settingsChannel = supabase.channel("realtime:settings-status");
    settingsChannel
      .on("broadcast", { event: "settings-change" }, (payload) => {
        if (payload.payload) {
          setSettings(payload.payload as WebSettings);
        } else {
          refreshData();
        }
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "settings" },
        () => {
          refreshData();
        }
      )
      .subscribe();

    // 5-second polling fallback
    const interval = setInterval(() => {
      refreshData();
    }, 5000);

    return () => {
      supabase.removeChannel(votesChannel);
      supabase.removeChannel(electionChannel);
      supabase.removeChannel(settingsChannel);
      clearInterval(interval);
    };
  }, [refreshData]);

  // Auto-slide effect (every 8 seconds)
  useEffect(() => {
    if (!autoSlide) return;
    const positions = data.positions ?? [];
    if (positions.length <= 1) return;

    const timer = setInterval(() => {
      setActivePositionId((current) => {
        if (current === "all") {
          return positions[0].id;
        }
        const currentIndex = positions.findIndex((p) => p.id === current);
        if (currentIndex === -1 || currentIndex === positions.length - 1) {
          return "all";
        }
        return positions[currentIndex + 1].id;
      });
    }, 8000);

    return () => clearInterval(timer);
  }, [autoSlide, data.positions]);

  const positions: PositionResult[] = data.positions ?? [];
  const summary = data.summary;
  const election = data.election;

  const displayedPositions =
    activePositionId === "all"
      ? positions
      : positions.filter((p) => p.id === activePositionId);

  const isDark = mounted && theme === "dark";

  // Obey tampilkan_hasil_live for public projector view
  if (!isAdmin && settings && !settings.tampilkan_hasil_live) {
    return (
      <div className="relative flex min-h-screen flex-col bg-background text-foreground justify-between">
        <header className="flex min-h-[72px] items-center justify-between border-b border-border-soft px-6 sm:px-10 bg-background/85 backdrop-blur-[20px]">
          <div className="flex items-center gap-3">
            {settings.logo_url && (
              <div className="relative size-8 overflow-hidden rounded-full border border-border-soft">
                <Image src={settings.logo_url} alt="Logo" fill className="object-cover" />
              </div>
            )}
            <span className="font-semibold text-sm sm:text-base">{settings.nama_penyelenggara}</span>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-full border border-border-soft bg-panel px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Masuk Admin
          </Link>
        </header>

        <main className="mx-auto grid max-w-xl place-items-center p-6 text-center">
          <Card className="rounded-[24px] border border-border-soft p-8 sm:p-12 bg-panel/40 backdrop-blur-[20px] shadow-float">
            <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-panel">
              <EyeOff className="size-6 text-amber-500" />
            </span>
            <h2 className="text-2xl font-semibold tracking-tight">Hasil Live Sedang Disembunyikan</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Penayangan hasil perolehan suara sementara sedang dinonaktifkan oleh penyelenggara. Layar ini akan otomatis menampilkan hasil secara langsung saat dibuka kembali.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              Terhubung ke server · Menunggu sinyal tayang
            </div>
          </Card>
        </main>

        <footer className="border-t border-border-soft py-4 text-center text-xs text-muted-foreground">
          {settings.nama_penyelenggara} &copy; {new Date().getFullYear()}
        </footer>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground transition-colors pb-28">
      {/* Top Header / Control Bar */}
      <header className="sticky top-0 z-30 flex min-h-[72px] flex-wrap items-center justify-between gap-4 border-b border-border-soft bg-background/85 px-6 py-3 backdrop-blur-[20px] sm:px-10">
        <div className="flex items-center gap-3">
          {!isAdmin && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-full border border-border-soft bg-panel px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> Admin
            </Link>
          )}

          {settings?.logo_url && (
            <div className="relative size-8 overflow-hidden rounded-full border border-border-soft">
              <Image src={settings.logo_url} alt="Logo" fill className="object-cover" />
            </div>
          )}

          <div>
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
              {election?.nama ?? "Hasil Pemilihan"}
            </h1>
            {settings?.nama_penyelenggara && (
              <p className="text-[11px] text-muted-foreground">{settings.nama_penyelenggara}</p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-full border border-border-soft bg-panel p-1">
            <button
              type="button"
              onClick={() => setViewMode("card")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === "card"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="size-3.5" /> Kartu
            </button>
            <button
              type="button"
              onClick={() => setViewMode("chart")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === "chart"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart3 className="size-3.5" /> Grafik
            </button>
          </div>

          {/* Auto-Slide Toggle */}
          {positions.length > 1 && (
            <Button
              type="button"
              variant={autoSlide ? "default" : "secondary"}
              size="sm"
              onClick={() => setAutoSlide(!autoSlide)}
              className="gap-1.5 text-xs"
              title="Pergantian otomatis antar-jabatan setiap 8 detik"
            >
              {autoSlide ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              Auto-Slide
            </Button>
          )}

          {/* Fullscreen Toggle */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={toggleFullscreen}
            className="gap-1.5 text-xs"
            title="Layar Penuh"
          >
            {isFullscreen ? <Minimize className="size-3.5" /> : <Fullscreen className="size-3.5" />}
            <span className="hidden md:inline">{isFullscreen ? "Keluar Penuh" : "Layar Penuh"}</span>
          </Button>

          {/* Dark Mode Toggle */}
          {mounted && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="gap-1.5 text-xs"
              title="Ganti Mode Gelap/Terang"
            >
              {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            </Button>
          )}

          {/* Admin shortcut to projector view */}
          {isAdmin && (
            <Button asChild size="sm" variant="default" className="gap-1.5 text-xs">
              <Link href="/live" target="_blank" rel="noreferrer">
                Layar Proyektor <ExternalLink className="size-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto w-full max-w-[1440px] px-6 py-8 sm:px-10">
        {/* Live Booth Activity Indicator */}
        {boothActiveAlert && (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-3 text-xs font-medium text-amber-700 dark:text-amber-400 backdrop-blur-[10px]">
            <span className="flex items-center gap-2.5">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-amber-500" />
              </span>
              <Zap className="size-3.5 text-amber-500" />
              <span>Pemilih sedang aktif memberikan suara di bilik...</span>
            </span>
            <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
              Bilik Sedang Digunakan
            </span>
          </div>
        )}

        {/* Status Banner */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-border-soft bg-panel/60 p-5 backdrop-blur-[10px]">
          <div className="flex items-center gap-3">
            {election?.status === "closed" ? (
              <>
                <span className="grid size-9 place-items-center rounded-full bg-foreground text-background">
                  <CheckCircle2 className="size-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-foreground px-2.5 py-0.5 text-[11px] font-semibold text-background uppercase tracking-wide">
                      Hasil Final
                    </span>
                    <span className="text-xs text-muted-foreground">Pemilihan Resmi Ditutup</span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Seluruh perolehan suara terkunci secara permanen dan sah.
                  </p>
                </div>
              </>
            ) : election?.status === "open" ? (
              <>
                <span className="relative flex size-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex size-3 rounded-full bg-emerald-600" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-600/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                      Hasil Sementara (Live)
                    </span>
                    <span className="text-xs text-muted-foreground">Pemungutan Suara Sedang Berlangsung</span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Hasil ini bersifat dinamis dan akan terus ter-update secara otomatis saat pemilih memberikan suara.
                  </p>
                </div>
              </>
            ) : (
              <>
                <span className="size-3 rounded-full bg-amber-500" />
                <div>
                  <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                    Draft Pemilu
                  </span>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Pemilihan belum dibuka. Belum ada suara yang masuk.
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              Diperbarui:{" "}
              <strong className="text-foreground">
                {lastRefreshedAt.toLocaleTimeString("id-ID")}
              </strong>
            </span>
            <button
              type="button"
              onClick={refreshData}
              disabled={isPending}
              className="inline-flex size-7 items-center justify-center rounded-full hover:bg-secondary-container transition-colors disabled:opacity-50"
              title="Segarkan data sekarang"
            >
              <RefreshCw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Position Filter Chips */}
        {positions.length > 1 && (
          <div className="mb-8 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActivePositionId("all")}
              className={`rounded-full px-5 py-2 text-xs font-medium transition-all ${
                activePositionId === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border-soft bg-panel text-muted-foreground hover:text-foreground"
              }`}
            >
              Semua Jabatan ({positions.length})
            </button>
            {positions.map((pos) => (
              <button
                key={pos.id}
                type="button"
                onClick={() => setActivePositionId(pos.id)}
                className={`rounded-full px-5 py-2 text-xs font-medium transition-all ${
                  activePositionId === pos.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-border-soft bg-panel text-muted-foreground hover:text-foreground"
                }`}
              >
                {pos.nama}
              </button>
            ))}
          </div>
        )}

        {/* Positions Content */}
        {displayedPositions.length === 0 ? (
          <Card className="rounded-[24px] p-12 text-center text-muted-foreground">
            Belum ada jabatan atau kandidat yang terdaftar pada pemilu ini.
          </Card>
        ) : (
          <div className="space-y-12">
            {displayedPositions.map((position) => (
              <section key={position.id} className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-border-soft pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Posisi Jabatan
                    </p>
                    <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                      {position.nama}
                    </h2>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Suara Sah:{" "}
                    <span className="font-semibold text-foreground">
                      {position.total_votes.toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>

                {viewMode === "card" ? (
                  /* Card View */
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {position.candidates.map((candidate) => (
                      <Card
                        key={candidate.id}
                        className={`group relative overflow-hidden rounded-[24px] border p-6 transition-all duration-300 hover:shadow-float ${
                          candidate.is_highest
                            ? "border-primary/80 dark:border-white/80 ring-1 ring-primary/20 bg-panel/30"
                            : "border-border-soft bg-white/70 dark:bg-panel/50"
                        }`}
                      >
                        {/* Winner Pill Badge */}
                        {candidate.is_highest && (
                          <div className="absolute right-4 top-4 z-10 flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow-sm dark:bg-white dark:text-black">
                            <Award className="size-3.5" />
                            <span>Suara Terbanyak</span>
                          </div>
                        )}

                        <div className="flex items-start gap-4">
                          {/* Candidate Avatar / Photo */}
                          <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-panel border border-border-soft">
                            {candidate.foto ? (
                              <Image
                                src={candidate.foto}
                                alt={candidate.nama}
                                fill
                                className="object-cover"
                                sizes="64px"
                              />
                            ) : (
                              <div className="grid h-full w-full place-items-center text-lg font-semibold text-muted-foreground">
                                {candidate.nomor}
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1 pr-12">
                            <span className="inline-block rounded-full bg-panel px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                              Nomor Urut {candidate.nomor}
                            </span>
                            <h3 className="mt-1 truncate text-lg font-medium tracking-tight text-foreground" title={candidate.nama}>
                              {candidate.nama}
                            </h3>
                            {candidate.info && (
                              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                                {candidate.info}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Votes and Percentage Bar */}
                        <div className="mt-6 space-y-2">
                          <div className="flex items-baseline justify-between">
                            <span className="text-3xl font-semibold tracking-tight text-foreground">
                              {candidate.percentage}%
                            </span>
                            <span className="text-xs text-muted-foreground font-medium">
                              {candidate.votes.toLocaleString("id-ID")} suara
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="h-2 w-full overflow-hidden rounded-full bg-panel">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ease-out ${
                                candidate.is_highest
                                  ? "bg-primary dark:bg-white"
                                  : "bg-outline"
                              }`}
                              style={{ width: `${Math.min(candidate.percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  /* Chart View (Recharts) */
                  <Card className="rounded-[24px] border border-border-soft p-6 sm:p-8 bg-white/70 dark:bg-panel/50">
                    <CardHeader className="p-0 pb-6">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        Diagram Perolehan Suara
                      </p>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="h-[360px] w-full">
                        {mounted && (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={position.candidates.map((c) => ({
                                name: `#${c.nomor} ${c.nama}`,
                                fullName: c.nama,
                                nomor: c.nomor,
                                votes: c.votes,
                                percentage: c.percentage,
                                is_highest: c.is_highest,
                              }))}
                              margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
                            >
                              <XAxis
                                dataKey="name"
                                stroke={isDark ? "#888888" : "#747878"}
                                fontSize={12}
                                tickLine={false}
                                axisLine={{ stroke: isDark ? "#4c4949" : "#e7e7e4" }}
                              />
                              <YAxis
                                stroke={isDark ? "#888888" : "#747878"}
                                fontSize={12}
                                tickLine={false}
                                axisLine={{ stroke: isDark ? "#4c4949" : "#e7e7e4" }}
                                allowDecimals={false}
                              />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const item = payload[0].payload;
                                    return (
                                      <div className="rounded-2xl border border-border-soft bg-background/95 p-3.5 shadow-float backdrop-blur-[20px] text-xs">
                                        <p className="font-semibold text-foreground">
                                          #{item.nomor} {item.fullName}
                                        </p>
                                        <p className="mt-1 text-muted-foreground">
                                          Suara:{" "}
                                          <strong className="text-foreground">
                                            {item.votes.toLocaleString("id-ID")}
                                          </strong>{" "}
                                          ({item.percentage}%)
                                        </p>
                                        {item.is_highest && (
                                          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-medium text-primary-foreground dark:bg-white dark:text-black">
                                            <Award className="size-3" /> Suara Terbanyak
                                          </span>
                                        )}
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Bar dataKey="votes" radius={[8, 8, 0, 0]}>
                                {position.candidates.map((entry) => (
                                  <Cell
                                    key={`cell-${entry.id}`}
                                    fill={
                                      entry.is_highest
                                        ? isDark
                                          ? "#ffffff"
                                          : "#000000"
                                        : isDark
                                        ? "#5e5e5e"
                                        : "#c4c7c7"
                                    }
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Floating Footer: Partisipasi & Rekonsiliasi Integritas */}
      {summary && (
        <footer className="fixed bottom-4 left-4 right-4 z-30 mx-auto max-w-[1400px]">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-full border border-border-soft bg-background/90 px-6 py-3.5 shadow-float backdrop-blur-[20px]">
            {/* Partisipasi Pemilih */}
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground sm:text-sm">
              <Users className="size-4 text-foreground" />
              <span>Partisipasi:</span>
              <strong className="font-semibold text-foreground">
                {summary.participation_percentage}%
              </strong>
              <span className="hidden sm:inline">
                ({summary.total_voted.toLocaleString("id-ID")} dari {summary.total_dpt.toLocaleString("id-ID")} DPT)
              </span>
            </div>

            {/* Total Suara Sah */}
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
              <Vote className="size-4 text-foreground" />
              <span>Total Suara Masuk:</span>
              <strong className="font-semibold text-foreground">
                {summary.total_votes_cast.toLocaleString("id-ID")}
              </strong>
            </div>

            {/* Integritas Rekonsiliasi */}
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              {summary.reconciliation_ok ? (
                <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" />
                  <span className="hidden sm:inline">Rekonsiliasi:</span> 100% Cocok
                </span>
              ) : (
                <span className="flex items-center gap-1.5 font-medium text-error">
                  <AlertCircle className="size-4" />
                  <span>Selisih Rekonsiliasi!</span>
                </span>
              )}
            </div>

            {/* Connection Status Indicator */}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span
                className={`size-2 rounded-full ${
                  connectionStatus === "realtime" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}
                title={connectionStatus === "realtime" ? "Terhubung Realtime" : "Koneksi Cadangan: Polling 5s"}
              />
              <span className="hidden lg:inline capitalize">{connectionStatus}</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
