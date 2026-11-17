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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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

// Item aktif ditampilkan hitam/putih penuh agar kontras jelas.
const ACTIVE_TOGGLE =
  "gap-1.5 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground";
const ACTIVE_TAB =
  "px-3 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground dark:data-[state=active]:border-primary";

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
          return isAdmin ? positions[0].id : positions[1 % positions.length].id;
        }
        const currentIndex = positions.findIndex((p) => p.id === current);
        if (currentIndex === -1 || currentIndex === positions.length - 1) {
          // Tampilan publik (1 layar) tidak memiliki opsi "Semua Jabatan".
          return isAdmin ? "all" : positions[0].id;
        }
        return positions[currentIndex + 1].id;
      });
    }, 8000);

    return () => clearInterval(timer);
  }, [autoSlide, data.positions, isAdmin]);

  const positions: PositionResult[] = data.positions ?? [];
  const summary = data.summary;
  const election = data.election;

  // Tampilan publik (/live) dibuat pas 1 layar: satu jabatan per layar, tanpa scroll halaman.
  const fit = !isAdmin;
  const activeId =
    fit && (activePositionId === "all" || !positions.some((p) => p.id === activePositionId))
      ? positions[0]?.id ?? "all"
      : activePositionId;

  const displayedPositions =
    activeId === "all"
      ? positions
      : positions.filter((p) => p.id === activeId);

  const isDark = mounted && theme === "dark";

  // Obey tampilkan_hasil_live for public projector view
  if (!isAdmin && settings && !settings.tampilkan_hasil_live) {
    return (
      <div className="relative flex h-dvh flex-col justify-between overflow-hidden bg-background text-foreground">
        <header className="flex min-h-16 shrink-0 items-center justify-between border-b bg-background px-4 sm:px-8">
          <div className="flex items-center gap-3">
            {settings.logo_url && (
              <div className="relative size-8 overflow-hidden rounded-full border border-border-soft">
                <Image src={settings.logo_url} alt="Logo" fill className="object-cover" />
              </div>
            )}
            <span className="font-semibold text-sm sm:text-base">{settings.nama_penyelenggara}</span>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin">
              <ArrowLeft className="size-3.5" /> Masuk Admin
            </Link>
          </Button>
        </header>

        <main className="mx-auto grid min-h-0 max-w-xl flex-1 place-items-center p-6 text-center">
          <Card className="gap-0 p-8 shadow-float sm:p-12">
            <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-muted">
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

        <footer className="shrink-0 border-t py-4 text-center text-xs text-muted-foreground">
          {settings.nama_penyelenggara} &copy; {new Date().getFullYear()}
        </footer>
      </div>
    );
  }

  return (
    <div
      className={
        fit
          ? "relative flex h-dvh flex-col overflow-hidden bg-background text-foreground transition-colors"
          : "relative flex min-h-screen flex-col bg-background pb-28 text-foreground transition-colors"
      }
    >
      {/* Top Header / Control Bar */}
      <header
        className={`z-30 flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-2.5 sm:px-8 ${
          fit ? "" : "sticky top-0"
        }`}
      >
        <div className="flex items-center gap-3">
          {!isAdmin && (
            <Button asChild variant="outline" size="sm">
              <Link href="/admin">
                <ArrowLeft className="size-3.5" /> Admin
              </Link>
            </Button>
          )}

          {settings?.logo_url && (
            <div className="relative size-8 overflow-hidden rounded-md border border-border-soft">
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
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={viewMode}
            onValueChange={(v) => v && setViewMode(v as "card" | "chart")}
            aria-label="Mode tampilan"
          >
            <ToggleGroupItem value="card" className={ACTIVE_TOGGLE}>
              <LayoutGrid className="size-3.5" /> Kartu
            </ToggleGroupItem>
            <ToggleGroupItem value="chart" className={ACTIVE_TOGGLE}>
              <BarChart3 className="size-3.5" /> Grafik
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Auto-Slide Toggle */}
          {positions.length > 1 && (
            <Button
              type="button"
              variant={autoSlide ? "default" : "outline"}
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
            variant="outline"
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
              variant="outline"
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
      <main
        className={
          isAdmin
            ? "w-full min-w-0 py-2"
            : "mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col px-4 py-3 sm:px-8"
        }
      >
        {/* Live Booth Activity Indicator */}
        {boothActiveAlert && (
          <div className="mb-3 flex shrink-0 items-center justify-between gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-5 py-3 text-xs font-medium text-amber-700 dark:text-amber-400 backdrop-blur-[10px]">
            <span className="flex items-center gap-2.5">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-amber-500" />
              </span>
              <Zap className="size-3.5 text-amber-500" />
              <span>Pemilih sedang aktif memberikan suara di bilik...</span>
            </span>
            <Badge variant="outline" className="rounded-md border-amber-500/40 bg-amber-500/20 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Bilik Sedang Digunakan
            </Badge>
          </div>
        )}

        {/* Status Banner */}
        <div
          className={`flex shrink-0 flex-col justify-between gap-3 rounded-md border bg-muted sm:flex-row sm:items-center ${
            fit ? "mb-3 px-4 py-3" : "mb-8 p-5"
          }`}
        >
          <div className="flex items-center gap-3">
            {election?.status === "closed" ? (
              <>
                <span className="grid size-9 place-items-center rounded-md bg-foreground text-background">
                  <CheckCircle2 className="size-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-[11px] font-semibold uppercase tracking-wide">
                      Hasil Final
                    </Badge>
                    <span className="text-xs text-muted-foreground">Pemilihan Resmi Ditutup</span>
                  </div>
                  <p className={`mt-0.5 text-sm text-muted-foreground ${fit ? "hidden lg:block" : ""}`}>
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
                    <Badge variant="outline" className="border-emerald-600/30 bg-emerald-600/15 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                      Hasil Sementara (Live)
                    </Badge>
                    <span className="text-xs text-muted-foreground">Pemungutan Suara Sedang Berlangsung</span>
                  </div>
                  <p className={`mt-0.5 text-sm text-muted-foreground ${fit ? "hidden lg:block" : ""}`}>
                    Hasil ini bersifat dinamis dan akan terus ter-update secara otomatis saat pemilih memberikan suara.
                  </p>
                </div>
              </>
            ) : (
              <>
                <span className="size-3 rounded-full bg-amber-500" />
                <div>
                  <Badge variant="outline" className="border-amber-500/30 bg-amber-500/15 text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                    Draft Pemilu
                  </Badge>
                  <p className={`mt-0.5 text-sm text-muted-foreground ${fit ? "hidden lg:block" : ""}`}>
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
                {mounted ? lastRefreshedAt.toLocaleTimeString("id-ID") : "—"}
              </strong>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={refreshData}
              disabled={isPending}
              className="size-7 rounded-md"
              title="Segarkan data sekarang"
            >
              <RefreshCw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Position Filter Chips */}
        {positions.length > 1 && (
          <Tabs value={activeId} onValueChange={setActivePositionId} className={`shrink-0 ${fit ? "mb-3" : "mb-8"}`}>
            <TabsList className="h-auto max-w-full flex-wrap justify-start">
              {!fit && (
                <TabsTrigger value="all" className={ACTIVE_TAB}>
                  Semua Jabatan ({positions.length})
                </TabsTrigger>
              )}
              {positions.map((pos) => (
                <TabsTrigger key={pos.id} value={pos.id} className={ACTIVE_TAB}>
                  {pos.nama}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {/* Positions Content */}
        {displayedPositions.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            Belum ada jabatan atau kandidat yang terdaftar pada pemilu ini.
          </Card>
        ) : (
          <div className={fit ? "flex min-h-0 flex-1 flex-col" : "space-y-12"}>
            {displayedPositions.map((position) => (
              <section key={position.id} className={fit ? "flex min-h-0 flex-1 flex-col gap-3" : "space-y-6"}>
                <div className="flex shrink-0 flex-col justify-between gap-2 border-b pb-3 sm:flex-row sm:items-end">
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
                  <div
                    className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${
                      fit ? "min-h-0 flex-1 content-center overflow-y-auto" : "gap-6"
                    }`}
                  >
                    {position.candidates.map((candidate) => (
                      <Card
                        key={candidate.id}
                        className={`group relative gap-0 overflow-hidden p-6 transition-all duration-300 hover:shadow-float ${
                          candidate.is_highest ? "border-primary ring-2 ring-primary" : ""
                        }`}
                      >
                        {/* Winner Pill Badge */}
                        {candidate.is_highest && (
                          <div className="absolute right-4 top-4 z-10">
                            <Badge variant="default" className="gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm">
                              <Award className="size-3.5" />
                              <span>Suara Terbanyak</span>
                            </Badge>
                          </div>
                        )}

                        <div className="flex items-start gap-4">
                          {/* Candidate Avatar / Photo */}
                          <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-panel border border-border-soft">
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
                            <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-xs font-semibold">
                              Nomor Urut {candidate.nomor}
                            </Badge>
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
                                  ? "bg-primary"
                                  : "bg-muted-foreground"
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
                  <Card className={`gap-0 p-6 sm:p-8 ${fit ? "min-h-0 flex-1" : ""}`}>
                    <CardHeader className="p-0 pb-4">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        Diagram Perolehan Suara
                      </p>
                    </CardHeader>
                    <CardContent className={`p-0 ${fit ? "flex min-h-0 flex-1 flex-col" : ""}`}>
                      <div className={fit ? "min-h-0 w-full flex-1" : "h-[360px] w-full"}>
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
                                      <div className="rounded-md border border-border-soft bg-background/95 p-3.5 shadow-float backdrop-blur-[20px] text-xs">
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
                                          <Badge variant="default" className="mt-2 gap-1 rounded-md text-[10px] font-medium">
                                            <Award className="size-3" /> Suara Terbanyak
                                          </Badge>
                                        )}
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Bar dataKey="votes" radius={[6, 6, 0, 0]}>
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
        <footer
          className={
            fit
              ? "mx-auto w-full max-w-[1440px] shrink-0 px-4 pb-3 sm:px-8"
              : "fixed bottom-4 left-4 right-4 z-30 mx-auto max-w-[1400px]"
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border bg-card px-5 py-3 shadow-float">
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
