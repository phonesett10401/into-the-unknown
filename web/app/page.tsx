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
import { DEPTH_CURVE, dive, publish, useDepth, waterAt } from "@/lib/dive";
import Ocean from "./Ocean";
import EiffelColumn from "./EiffelColumn";

const zones = zonesData.zones;
const gates = quizData.gates;
const milestones = buildingsData.milestones;
const MAX = zonesData.maxDepth;

// Local-only: open every zone to inspect the deep water. Ignored whenever a contract is configured.
const PREVIEW_ALL = !hasContract && process.env.NEXT_PUBLIC_PREVIEW_ALL === "1";

// Rotate each question's options so the answer is never always first.
const ROTATE = [2, 0, 3, 1, 2];
function optionsFor(i: number) {
  const o = gates[i].options;
  const r = ROTATE[i] % o.length;
  return [...o.slice(o.length - r), ...o.slice(0, o.length - r)];
}

const bit = (i: number) => 1 << i;
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

type Stats = { cleared: number[]; skipped: number[] };
type Toast = { text: string; hash?: string } | null;

export default function Page() {
  const [passed, setPassed] = useState(PREVIEW_ALL ? 0b11111 : 0);
  const [badges, setBadges] = useState(PREVIEW_ALL ? 0b10111 : 0);
  const [account, setAccount] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const sections = useRef<(HTMLElement | null)[]>([]);
  const floorRef = useRef<HTMLElement | null>(null);

  // First zone the diver has not passed; everything below it is not rendered.
  let frontier = 0;
  while (frontier < zones.length && passed & bit(frontier)) frontier++;

  // Scroll -> depth. Each zone gets equal scroll distance, so depth accelerates as you fall.
  // Writes to the shared dive store; only the HUD and the ocean listen, so the page itself never re-renders on scroll.
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      dive.zones = sections.current.flatMap((el, i) =>
        el ? [{ top: el.offsetTop, height: el.offsetHeight, from: zones[i].from, to: zones[i].to }] : [],
      );
      dive.floorTop = floorRef.current ? floorRef.current.offsetTop : null;
      dive.vh = window.innerHeight;
    };
    const update = () => {
      raf = 0;
      dive.scrollY = window.scrollY;
      const mid = dive.scrollY + dive.vh * 0.5;
      let d = 0;
      for (const z of dive.zones) {
        if (mid < z.top) break;
        const t = Math.min(1, (mid - z.top) / z.height);
        d = z.from + (z.to - z.from) * Math.pow(t, DEPTH_CURVE);
      }
      if (dive.floorTop !== null && mid >= dive.floorTop) d = MAX;
      dive.depth = d;
      const rgb = waterAt(d);
      document.body.style.backgroundColor = `rgb(${rgb.map(Math.round).join(",")})`;
      publish();
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const onResize = () => {
      measure();
      onScroll();
    };
    measure();
    update();
    document.documentElement.classList.add("sc-ready");
    const ro = new ResizeObserver(onResize);
    ro.observe(document.body);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
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
        text: tx ? `${zones[i].name} badge earned. Final in ${(tx.ms / 1000).toFixed(1)} s` : `${zones[i].name} badge earned`,
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
        text: tx ? `Paid past ${zones[i].name}. Final in ${(tx.ms / 1000).toFixed(1)} s` : `Paid past ${zones[i].name}`,
        hash: tx?.hash,
      });
      refreshStats();
    },
    [refreshStats],
  );

  return (
    <main>
      <Ocean />
      <EiffelColumn />
      <Hud />

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
        <div className="toast" role="status">
          {toast.text}
          {toast.hash && (
            <a href={`${EXPLORER}/tx/${toast.hash}`} target="_blank" rel="noreferrer">
              view
            </a>
          )}
        </div>
      )}

      <section className="surface" data-sc-act="flow">
        <h1 data-sc-cue>Into The Unknown</h1>
        <p className="lede" data-sc-cue>
          The ocean is {fmt(MAX)} metres deep. Fall through it.
        </p>
        <p className="rule" data-sc-cue>
          Money buys time. Only knowledge buys the badge.
        </p>
      </section>

      {zones.slice(0, Math.min(frontier + 1, zones.length)).map((z, i) => (
        <section
          key={z.id}
          className={`zone ${i % 2 ? "trail" : "lead"}`}
          data-sc-act="flow"
          ref={(el) => {
            sections.current[i] = el;
          }}
        >
          <div className="block" data-sc-cue>
            <h2>{z.name}</h2>
            <p className="meta">
              {z.scientific}, {fmt(z.from)} to {fmt(z.to)} m
            </p>
            <p className="lede">{z.blurb}</p>
            <p className="light">{z.light}</p>
          </div>

          <ul className="block facts" data-sc-cue>
            {z.facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>

          <div className="block cards">
            {z.creatures.map((c) => (
              <article key={c.name} className="card" data-sc-cue>
                <h3>{c.name}</h3>
                <p className="sci">
                  {c.scientific}, {fmt(c.from)} to {fmt(c.to)} m
                </p>
                <p>{c.note}</p>
              </article>
            ))}
          </div>

          <div className="block cards">
            {z.vessels.map((v) => (
              <article key={v.name} className="card vessel" data-sc-cue>
                <h3>{v.name}</h3>
                <p className="sci">
                  {fmt(v.depth)} m{v.year ? `, ${v.year}` : ""}
                  {v.nation !== "-" ? `, ${v.nation}` : ""}
                </p>
                <p>{v.note}</p>
              </article>
            ))}
          </div>

          <div className="block landmark" data-sc-cue>
            <h3>{z.landmark}</h3>
            <p className="meta">{fmt(z.landmarkDepth)} m</p>
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
        <section className="floor" data-sc-act="flow" ref={floorRef}>
          <h2 data-sc-cue>You reached the bottom.</h2>
          <p className="meta" data-sc-cue>
            Challenger Deep, {fmt(MAX)} m
          </p>
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

function Hud() {
  const depth = useDepth();
  const zoneNow = zones.find((z) => depth <= z.to) ?? zones[zones.length - 1];
  const milestone = [...milestones].reverse().find((m) => depth >= m.depth - 1);
  return (
    <header className="hud" data-sc-verify-state={depth}>
      <div className="readout">
        <div className="depth">{fmt(depth)} m</div>
        <div className="zone-name">{depth < 1 ? "The surface" : zoneNow.name}</div>
        <div className="pressure">{fmt(1 + depth / 10)} atm</div>
      </div>
      {milestone && depth < MAX && <div className="milestone">{milestone.line}</div>}
    </header>
  );
}

function FloorVerdict({ paid }: { paid: number }) {
  if (paid === 0) return <p className="verdict">Every badge earned. You read the whole ocean.</p>;
  const words = ["", "one zone", "two zones", "three zones", "four zones", "all five zones"];
  return (
    <p className="verdict" data-sc-cue>
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
    <div className="gate" role="group" aria-label={`Gate at ${fmt(g.depth)} metres`} data-sc-cue>
      <p className="meta">
        {fmt(g.depth)} m. {allowSkip ? "You cannot go deeper yet." : `Earn the ${zones[i].name.replace(/^The /, "")} badge.`}
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
          {cleared} {cleared === 1 ? "diver has" : "divers have"} earned this badge, {skipped} paid to skip
        </p>
      )}
    </div>
  );
}
