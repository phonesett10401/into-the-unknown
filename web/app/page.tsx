"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import zonesData from "@/lib/zones.json";
import quizData from "@/lib/quiz.json";
import buildingsData from "@/lib/buildings.json";
import {
  EXPLORER,
  TxResult,
  connect,
  explainError,
  hasContract,
  readDiver,
  readStats,
  sendClear,
  sendSkip,
} from "@/lib/chain";
import Water, { WaterState } from "./Water";
import ScaleColumn from "./ScaleColumn";

const zones = zonesData.zones;
const gates = quizData.gates;
const milestones = buildingsData.milestones;
const MAX = zonesData.maxDepth;

// Rotate each question's options so the answer is never always first.
const ROTATE = [2, 0, 3, 1, 2];
function optionsFor(i: number) {
  const o = gates[i].options;
  const r = ROTATE[i] % o.length;
  return [...o.slice(o.length - r), ...o.slice(0, o.length - r)];
}

const COLOR_STOPS: [number, [number, number, number]][] = [
  [0, [42, 143, 196]],
  [200, [14, 77, 133]],
  [1000, [6, 34, 74]],
  [4000, [3, 13, 31]],
  [6000, [1, 5, 13]],
  [MAX, [0, 0, 0]],
];
function waterAt(d: number): [number, number, number] {
  for (let i = 1; i < COLOR_STOPS.length; i++) {
    const [d1, c1] = COLOR_STOPS[i];
    const [d0, c0] = COLOR_STOPS[i - 1];
    if (d <= d1) {
      const t = (d - d0) / (d1 - d0);
      return c0.map((v, k) => Math.round(v + (c1[k] - v) * t)) as [number, number, number];
    }
  }
  return [0, 0, 0];
}

const bit = (i: number) => 1 << i;
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

type Stats = { cleared: number[]; skipped: number[] };
type Toast = { text: string; hash?: string } | null;

export default function Page() {
  const [depth, setDepth] = useState(0);
  const [passed, setPassed] = useState(0);
  const [badges, setBadges] = useState(0);
  const [account, setAccount] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const sections = useRef<(HTMLElement | null)[]>([]);
  const floorRef = useRef<HTMLElement | null>(null);
  const water = useRef<WaterState>({ depth: 0, travel: 0, rgb: COLOR_STOPS[0][1] });

  // First zone the diver has not passed; everything below it is not rendered.
  let frontier = 0;
  while (frontier < zones.length && passed & bit(frontier)) frontier++;

  // Scroll -> depth. Each zone gets equal scroll distance, so depth accelerates as you fall.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const mid = window.scrollY + window.innerHeight * 0.5;
      let d = 0;
      sections.current.forEach((el, i) => {
        if (!el) return;
        const top = el.offsetTop;
        if (mid < top) return;
        const t = Math.min(1, (mid - top) / el.offsetHeight);
        d = zones[i].from + (zones[i].to - zones[i].from) * Math.pow(t, 1.4);
      });
      if (floorRef.current && mid >= floorRef.current.offsetTop) d = MAX;
      setDepth(d);
      const rgb = waterAt(d);
      water.current = { depth: d, travel: window.scrollY, rgb };
      document.body.style.background = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [frontier]);

  const refreshStats = useCallback(() => {
    if (!hasContract) return;
    readStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    refreshStats();
    const id = setInterval(refreshStats, 8000);
    return () => clearInterval(id);
  }, [refreshStats]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  const ensureAccount = useCallback(async () => {
    if (account) return account;
    const a = await connect();
    setAccount(a);
    try {
      const d = await readDiver(a);
      setPassed((p) => p | d.passed);
      setBadges((b) => b | d.badges);
    } catch {}
    return a;
  }, [account]);

  const onCleared = useCallback(
    (i: number, tx?: TxResult) => {
      setPassed((p) => p | bit(i));
      setBadges((b) => b | bit(i));
      setToast({
        text: tx ? `${zones[i].name} badge earned · final in ${(tx.ms / 1000).toFixed(1)} s` : `${zones[i].name} badge earned`,
        hash: tx?.hash,
      });
      refreshStats();
    },
    [refreshStats],
  );

  const onSkipped = useCallback(
    (i: number, tx?: TxResult) => {
      setPassed((p) => p | bit(i));
      setToast({
        text: tx ? `Paid past ${zones[i].name} · final in ${(tx.ms / 1000).toFixed(1)} s` : `Paid past ${zones[i].name}`,
        hash: tx?.hash,
      });
      refreshStats();
    },
    [refreshStats],
  );

  const zoneNow = zones.find((z) => depth <= z.to) ?? zones[zones.length - 1];
  const milestone = [...milestones].reverse().find((m) => depth >= m.depth - 1);

  return (
    <main>
      <Water state={water} />
      <ScaleColumn depth={depth} />
      <header className="hud">
        <div className="readout">
          <div className="depth">{fmt(depth)} m</div>
          <div className="zone-name">{depth < 1 ? "The surface" : zoneNow.name}</div>
          <div className="pressure">{fmt(1 + depth / 10)} atm</div>
        </div>
        {milestone && <div className="milestone">{milestone.line}</div>}
      </header>

      <aside className="shelf" aria-label="Badges">
        {zones.map((z, i) => {
          const state = badges & bit(i) ? "earned" : passed & bit(i) ? "paid" : "empty";
          return (
            <span key={z.id} className={`slot ${state}`} title={`${z.name}: ${state}`}>
              {i + 1}
            </span>
          );
        })}
      </aside>

      {toast && (
        <div className="toast">
          {toast.text}
          {toast.hash && (
            <a href={`${EXPLORER}/tx/${toast.hash}`} target="_blank" rel="noreferrer">
              view
            </a>
          )}
        </div>
      )}

      <section className="surface">
        <p className="kicker">Avalanche · Fuji</p>
        <h1>Into The Unknown</h1>
        <p className="lede">
          The ocean is {fmt(MAX)} metres deep. Scroll to fall through it.
        </p>
        <p className="rule">Money buys time. Only knowledge buys the badge.</p>
        <p className="hint">scroll ↓</p>
      </section>

      {zones.slice(0, Math.min(frontier + 1, zones.length)).map((z, i) => (
        <section
          key={z.id}
          className="zone"
          ref={(el) => {
            sections.current[i] = el;
          }}
        >
          <div className="block">
            <p className="kicker">
              {z.scientific} · {fmt(z.from)}–{fmt(z.to)} m
            </p>
            <h2>{z.name}</h2>
            <p className="lede">{z.blurb}</p>
            <p className="light">{z.light}</p>
          </div>

          <ul className="block facts">
            {z.facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>

          <div className="block cards">
            {z.creatures.map((c) => (
              <article key={c.name} className="card">
                <p className="kicker">
                  {fmt(c.from)}–{fmt(c.to)} m
                </p>
                <h3>{c.name}</h3>
                <p className="sci">{c.scientific}</p>
                <p>{c.note}</p>
              </article>
            ))}
          </div>

          <div className="block cards">
            {z.vessels.map((v) => (
              <article key={v.name} className="card vessel">
                <p className="kicker">
                  {fmt(v.depth)} m{v.year ? ` · ${v.year}` : ""}
                  {v.nation !== "-" ? ` · ${v.nation}` : ""}
                </p>
                <h3>{v.name}</h3>
                <p>{v.note}</p>
              </article>
            ))}
          </div>

          <div className="block landmark">
            <p className="kicker">{fmt(z.landmarkDepth)} m</p>
            <h3>{z.landmark}</h3>
          </div>

          {!(passed & bit(i)) && (
            <Gate
              index={i}
              stats={stats}
              ensureAccount={ensureAccount}
              onCleared={onCleared}
              onSkipped={onSkipped}
              allowSkip
            />
          )}
        </section>
      ))}

      {frontier >= zones.length && (
        <section className="floor" ref={floorRef}>
          <p className="kicker">Challenger Deep · {fmt(MAX)} m</p>
          <h2>You reached the bottom.</h2>
          <div className="collection">
            {zones.map((z, i) => {
              const earned = !!(badges & bit(i));
              return (
                <div key={z.id} className={`badge ${earned ? "earned" : "paid"}`}>
                  <span className="num">{i + 1}</span>
                  <span className="label">{z.name.replace("The ", "")}</span>
                  <span className="state">{earned ? "earned" : "paid"}</span>
                </div>
              );
            })}
          </div>
          <FloorVerdict paid={zones.filter((_, i) => !(badges & bit(i))).length} />
          <div className="earn-back">
            {zones.map((z, i) =>
              badges & bit(i) ? null : (
                <Gate
                  key={z.id}
                  index={i}
                  stats={stats}
                  ensureAccount={ensureAccount}
                  onCleared={onCleared}
                  onSkipped={onSkipped}
                  allowSkip={false}
                />
              ),
            )}
          </div>
          <button className="again" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            Back to the surface
          </button>
        </section>
      )}
    </main>
  );
}

function FloorVerdict({ paid }: { paid: number }) {
  if (paid === 0) return <p className="verdict">Every badge earned. You read the whole ocean.</p>;
  const words = ["", "one zone", "two zones", "three zones", "four zones", "all five zones"];
  return (
    <p className="verdict">
      You paid your way past {words[paid]}. <span>Go back and earn {paid === 1 ? "it" : "them"}.</span>
    </p>
  );
}

function Gate(props: {
  index: number;
  stats: Stats | null;
  ensureAccount: () => Promise<string>;
  onCleared: (i: number, tx?: TxResult) => void;
  onSkipped: (i: number, tx?: TxResult) => void;
  allowSkip: boolean;
}) {
  const { index: i, stats, ensureAccount, onCleared, onSkipped, allowSkip } = props;
  const g = gates[i];
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function answer(opt: string) {
    if (busy) return;
    setError(null);
    if (opt !== g.answer) {
      setError("Not that one. Try again.");
      return;
    }
    if (!hasContract) {
      onCleared(i);
      return;
    }
    setBusy(opt);
    try {
      await ensureAccount();
      const tx = await sendClear(i, opt);
      onCleared(i, tx);
    } catch (e) {
      setError(explainError(e));
    } finally {
      setBusy(null);
    }
  }

  async function skip() {
    if (busy) return;
    setError(null);
    if (!hasContract) {
      onSkipped(i);
      return;
    }
    setBusy("skip");
    try {
      await ensureAccount();
      const tx = await sendSkip(i);
      onSkipped(i, tx);
    } catch (e) {
      setError(explainError(e));
    } finally {
      setBusy(null);
    }
  }

  const cleared = stats?.cleared[i] ?? null;
  const skipped = stats?.skipped[i] ?? null;

  return (
    <div className="gate" role="group" aria-label={`Gate at ${fmt(g.depth)} metres`}>
      <p className="kicker">
        {fmt(g.depth)} m · {allowSkip ? "you cannot go deeper yet" : `earn the ${zones[i].name} badge`}
      </p>
      <h3>{g.question}</h3>
      <div className="options">
        {optionsFor(i).map((opt) => (
          <button key={opt} onClick={() => answer(opt)} disabled={!!busy} className={busy === opt ? "pending" : ""}>
            {busy === opt ? "Confirming…" : opt}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      {allowSkip && (
        <button className="skip" onClick={skip} disabled={!!busy}>
          {busy === "skip" ? "Confirming…" : "or skip for 0.001 AVAX"}
        </button>
      )}
      {cleared !== null && skipped !== null && (
        <p className="count">
          {cleared} {cleared === 1 ? "diver has" : "divers have"} earned this badge · {skipped} paid to skip
        </p>
      )}
    </div>
  );
}
