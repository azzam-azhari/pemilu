"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { castBooth, leaveBooth, readBooth, startBooth, touchBooth } from "@/actions/booth";
import { reasons, type Position, type SessionResult } from "@/lib/validations/booth";
import Image from "next/image";
import { Check, ChevronLeft, ChevronRight, LogOut, Maximize, Minimize } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ThemeToggle } from "@/components/theme-toggle";

export function Booth({
  booth,
  name,
  hasSession,
}: {
  booth: string | null;
  name: string;
  hasSession: boolean;
}) {
  const [stage, setStage] = useState<"input" | "checking" | "voting" | "success">(
    hasSession ? "checking" : "input"
  );
  const [positions, setPositions] = useState<Position[]>([]);
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState("");
  const [used, setUsed] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [vision, setVision] = useState<{ nama: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState("—");
  const [remaining, setRemaining] = useState(120);
  const [retry, setRetry] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const deadline = useRef(0);
  const retryDeadline = useRef(0);
  const lastTouch = useRef(0);
  const inflight = useRef(false);
  const generation = useRef(0);
  const backgroundBusy = useRef(false);

  const clear = useCallback(() => {
    setCode("");
    setChoices({});
    setStep(0);
    setPositions([]);
    setTitle("");
    setConfirm(false);
    setVision(null);
  }, []);

  const apply = useCallback(
    (result: SessionResult) => {
      if (!result.ok) {
        setMessage(reasons[result.reason] ?? "Permintaan tidak dapat diproses.");
        if (
          [
            "sesi_berakhir",
            "kode_sudah_digunakan",
            "pemilu_belum_dibuka",
            "bilik_tidak_valid",
            "surat_suara_tidak_tersedia",
          ].includes(result.reason)
        ) {
          generation.current++;
          clear();
          setStage("input");
          if (result.reason === "kode_sudah_digunakan") setUsed(true);
        }
        return;
      }
      if (result.state === "submitted") {
        generation.current++;
        clear();
        setMessage("");
        setStage("success");
        return;
      }
      if (result.state === "active" && result.positions && result.remainingMs !== undefined) {
        if ((result.boothId ?? null) !== booth) {
          clear();
          setStage("input");
          setMessage("Sesi berasal dari bilik lain. Masukkan kode kembali.");
          return;
        }
        deadline.current = Date.now() + result.remainingMs;
        setRemaining(Math.ceil(result.remainingMs / 1000));
        setPositions(result.positions);
        setTitle(result.electionName ?? "Pemilihan");
        setStage("voting");
        setCode("");
        setMessage("");
      }
    },
    [booth, clear]
  );

  const request = useCallback(
    async (fn: () => Promise<SessionResult>) => {
      if (inflight.current) return;
      inflight.current = true;
      setBusy(true);
      const current = ++generation.current;
      try {
        const result = await fn();
        if (generation.current === current) apply(result);
      } catch {
        if (generation.current === current) setMessage(reasons.layanan_tidak_tersedia);
      } finally {
        inflight.current = false;
        setBusy(false);
      }
    },
    [apply]
  );

  const background = useCallback(
    async (fn: () => Promise<SessionResult>) => {
      if (inflight.current || backgroundBusy.current) return;
      backgroundBusy.current = true;
      const current = generation.current;
      try {
        const r = await fn();
        if (current === generation.current && !inflight.current) apply(r);
      } catch {
        if (current === generation.current) setMessage(reasons.layanan_tidak_tersedia);
      } finally {
        backgroundBusy.current = false;
      }
    },
    [apply]
  );

  useEffect(() => {
    if (!hasSession) return;
    let active = true;
    readBooth()
      .then((r) => {
        if (active) {
          apply(r);
          if (!r.ok && r.reason === "layanan_tidak_tersedia") setStage("input");
        }
      })
      .catch(() => {
        if (active) {
          setStage("input");
          setMessage(reasons.layanan_tidak_tersedia);
        }
      });
    return () => {
      active = false;
    };
  }, [hasSession, apply]);

  useEffect(() => {
    const timer = setInterval(() => {
      setClock(new Date().toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" }));
      setRetry(Math.max(0, Math.ceil((retryDeadline.current - Date.now()) / 1000)));
      if (stage === "voting") setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [stage]);

  useEffect(() => {
    const change = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", change);
    return () => document.removeEventListener("fullscreenchange", change);
  }, []);

  useEffect(() => {
    if (stage !== "voting") return;
    const poll = setInterval(() => {
      void background(readBooth);
    }, 5000);
    const activity = () => {
      if (inflight.current || backgroundBusy.current || Date.now() - lastTouch.current < 15000) return;
      lastTouch.current = Date.now();
      void background(touchBooth);
    };
    for (const event of ["pointerdown", "keydown", "scroll"])
      window.addEventListener(event, activity, { passive: true });
    return () => {
      clearInterval(poll);
      for (const event of ["pointerdown", "keydown", "scroll"])
        window.removeEventListener(event, activity);
    };
  }, [stage, background]);

  useEffect(() => {
    if (stage !== "voting" || remaining > 0 || busy) return;
    const timer = setTimeout(async () => {
      generation.current++;
      clear();
      setStage("checking");
      setMessage(reasons.sesi_berakhir);
      try {
        await leaveBooth();
      } finally {
        setStage("input");
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [stage, remaining, busy, clear]);

  useEffect(() => {
    if (stage !== "success") return;
    const timer = setTimeout(async () => {
      generation.current++;
      clear();
      setStage("checking");
      try {
        await leaveBooth();
      } finally {
        setStage("input");
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [stage, clear]);

  const complete = positions.length > 0 && positions.every((p) => p.candidates.some((c) => c.id === choices[p.id]));
  const current = positions[Math.min(step, Math.max(positions.length - 1, 0))];
  const isLast = step >= positions.length - 1;
  const cols = current ? Math.min(current.candidates.length, 4) : 1;
  const gridCols =
    cols >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : cols === 3 ? "sm:grid-cols-3" : cols === 2 ? "sm:grid-cols-2" : "";

  return (
    <div className="relative mx-auto flex h-full w-full max-w-[1440px] flex-col px-4 sm:px-8">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest">{name}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{clock} WIB</p>
        </div>
        <div className="flex gap-2">
          <ThemeToggle />
          <Button
            variant="outline"
            onClick={async () => {
              try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else await document.documentElement.requestFullscreen();
              } catch {
                setMessage("Layar penuh tidak tersedia pada perangkat ini.");
              }
            }}
          >
            {fullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
            <span className="hidden sm:inline">{fullscreen ? "Keluar layar penuh" : "Layar penuh"}</span>
          </Button>
          {stage === "voting" && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void request(async () => {
                  const r = await leaveBooth();
                  if (r.ok) {
                    generation.current++;
                    clear();
                    setStage("input");
                    setMessage("");
                  }
                  return r;
                })
              }
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Keluar Sesi</span>
            </Button>
          )}
        </div>
      </header>

      {message && (
        <Alert variant="destructive" className="mt-3 shrink-0">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {stage === "checking" && (
        <div className="grid flex-1 place-items-center">
          <p className="text-muted-foreground" role="status">
            Memeriksa sesi…
          </p>
        </div>
      )}

      {stage === "input" && (
        <div className="grid min-h-0 flex-1 place-items-center py-4">
          <Card className="w-full max-w-lg gap-0 p-6 sm:p-8">
            <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Selamat datang</p>
            <h1 className="text-3xl font-semibold">Suara Anda berarti.</h1>
            <p className="my-5 text-muted-foreground">Masukkan kode unik dari petugas untuk membuka surat suara.</p>
            <form
              className="space-y-5"
              onSubmit={async (e) => {
                e.preventDefault();
                if (busy || retry) return;
                setUsed(false);
                await request(async () => {
                  const r = await startBooth({ code, booth });
                  if (r.retryAfter) {
                    retryDeadline.current = Date.now() + r.retryAfter * 1000;
                    setRetry(r.retryAfter);
                    setMessage("Terlalu banyak percobaan. Tunggu sebelum mencoba kembali.");
                    return { ok: false, reason: "terlalu_banyak_percobaan" };
                  }
                  return r;
                });
              }}
            >
              <div className="grid gap-2">
                <Label htmlFor="booth-code" className="text-sm font-medium">
                  Kode unik
                </Label>
                <Input
                  id="booth-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  name="code"
                  required
                  maxLength={64}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="h-14 w-full text-center text-xl uppercase tracking-widest md:text-xl"
                />
              </div>
              <Button className="w-full" size="lg" disabled={busy || retry > 0}>
                {retry > 0 ? "Coba lagi dalam " + retry + " detik" : busy ? "Memeriksa…" : "Buka Surat Suara"}
              </Button>
            </form>
          </Card>
        </div>
      )}

      {stage === "voting" && current && (
        <>
          <div className="flex shrink-0 flex-wrap items-end justify-between gap-2 pt-4 pb-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {title} · Jabatan {step + 1} dari {positions.length}
              </p>
              <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">{current.nama}</h1>
            </div>
            <p className="text-sm text-muted-foreground">Pilih satu kandidat.</p>
          </div>

          <RadioGroup
            key={current.id}
            value={choices[current.id] ?? ""}
            onValueChange={(v) => setChoices((old) => ({ ...old, [current.id]: v }))}
            disabled={busy}
            aria-label={current.nama}
            className={`grid min-h-0 flex-1 auto-rows-fr grid-cols-1 gap-3 overflow-y-auto pb-3 sm:gap-4 ${gridCols}`}
          >
            {current.candidates.map((c) => {
              const selected = choices[current.id] === c.id;
              const id = `cand-${current.id}-${c.id}`;
              return (
                <Card
                  key={c.id}
                  className={`min-h-0 gap-0 overflow-hidden p-0 transition-all ${
                    selected ? "border-primary ring-2 ring-primary" : "hover:border-foreground/40"
                  }`}
                >
                  <Label htmlFor={id} className="flex min-h-0 flex-1 cursor-pointer flex-col items-stretch gap-0 font-normal">
                    {c.foto ? (
                      <CandidatePhoto url={c.foto} name={c.nama} />
                    ) : (
                      <div className="grid min-h-0 flex-1 place-items-center bg-muted text-5xl font-semibold text-muted-foreground">
                        {c.nomor}
                      </div>
                    )}
                    <div className="flex shrink-0 items-start gap-3 p-4">
                      <RadioGroupItem id={id} value={c.id} className="mt-1 size-5" />
                      <div className="min-w-0">
                        <span className="block text-xs uppercase tracking-widest text-muted-foreground">
                          Nomor {c.nomor}
                        </span>
                        <span className="mt-1 block truncate text-lg font-semibold">{c.nama}</span>
                        {c.info && <span className="mt-1 line-clamp-1 text-sm text-muted-foreground">{c.info}</span>}
                      </div>
                    </div>
                  </Label>
                  <div className="shrink-0 px-4 pb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() =>
                        setVision({
                          nama: c.nama,
                          text: c.visi_misi ?? "Visi dan misi belum tersedia.",
                        })
                      }
                    >
                      Lihat Visi & Misi
                    </Button>
                  </div>
                </Card>
              );
            })}
          </RadioGroup>

          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t py-3">
            <div>
              <p className="font-medium">
                {positions.filter((p) => choices[p.id]).length} dari {positions.length} jabatan dipilih
              </p>
              <p className="text-sm text-muted-foreground">
                {remaining <= 30
                  ? "Sesi akan berakhir. Berinteraksilah untuk melanjutkan."
                  : "Pilihan Anda bersifat rahasia."}
              </p>
            </div>
            <div className="flex gap-2">
              {positions.length > 1 && (
                <Button variant="outline" disabled={step === 0 || busy} onClick={() => setStep((s) => Math.max(0, s - 1))}>
                  <ChevronLeft className="size-4" /> Sebelumnya
                </Button>
              )}
              {isLast ? (
                <Button disabled={!complete || busy} onClick={() => setConfirm(true)}>
                  Konfirmasi & Simpan
                </Button>
              ) : (
                <Button
                  disabled={!choices[current.id] || busy}
                  onClick={() => setStep((s) => Math.min(positions.length - 1, s + 1))}
                >
                  Berikutnya <ChevronRight className="size-4" />
                </Button>
              )}
            </div>
          </footer>
        </>
      )}

      {stage === "success" && (
        <div className="grid flex-1 place-items-center">
          <Card className="w-full max-w-lg items-center p-8 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-6" />
            </span>
            <h1 className="text-3xl font-semibold">Terima kasih!</h1>
            <p role="status" className="text-muted-foreground">
              Suara Anda berhasil disimpan. Bilik kembali siap dalam 4 detik.
            </p>
          </Card>
        </div>
      )}

      <Modal open={used} onOpenChange={setUsed} title="Hak Suara Sudah Digunakan">
        <p className="text-muted-foreground">
          Kode ini sudah dipakai. Suara yang tersimpan tidak dapat diubah. Hubungi petugas bila memerlukan bantuan.
        </p>
      </Modal>

      <Modal open={Boolean(vision)} onOpenChange={() => setVision(null)} title={vision?.nama ?? "Visi & Misi"}>
        <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{vision?.text}</p>
      </Modal>

      <Modal open={confirm} onOpenChange={setConfirm} title="Konfirmasi pilihan Anda" locked={busy}>
        <ul className="space-y-4">
          {positions.map((p) => (
            <li key={p.id}>
              <p className="text-sm text-muted-foreground">{p.nama}</p>
              <p className="font-medium">{p.candidates.find((c) => c.id === choices[p.id])?.nama}</p>
            </li>
          ))}
        </ul>
        <p className="my-6 text-sm text-muted-foreground">Pilihan tidak dapat diubah setelah disimpan.</p>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={busy || !complete}
            onClick={() =>
              void request(() =>
                castBooth(
                  positions.map((p) => ({
                    position_id: p.id,
                    candidate_id: choices[p.id],
                  }))
                )
              )
            }
          >
            {busy ? "Menyimpan…" : "Ya, Simpan Pilihan Saya"}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => setConfirm(false)}>
            Ganti Pilihan
          </Button>
        </div>
        {message && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
      </Modal>
    </div>
  );
}

function CandidatePhoto({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <div className="grid min-h-0 flex-1 place-items-center bg-muted text-sm text-muted-foreground">
        Foto tidak tersedia
      </div>
    );
  return (
    <div className="relative min-h-24 flex-1 overflow-hidden bg-muted">
      <Image src={url} alt={"Foto " + name} fill className="object-cover object-top" onError={() => setFailed(true)} unoptimized />
    </div>
  );
}
