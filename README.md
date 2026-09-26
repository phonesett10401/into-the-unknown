# Into The Unknown

**Fall 10,935 metres to the bottom of the Challenger Deep.** At every real ocean
zone a gate stops you. Answer its question and you earn that zone's badge on
Avalanche. Or pay 0.001 AVAX to skip it, and arrive at the bottom with an empty
collection.

**Money buys time. Only knowledge buys the badge.**

Consumer App track · Team1 Codebase Hackathon: Chula Edition · 26 September 2026

| | |
|---|---|
| Live | _Vercel URL_ |
| Contract | [`0xd75564Df35299e5723D279157396bd7DB5C124f7`](https://testnet.snowtrace.io/address/0xd75564Df35299e5723D279157396bd7DB5C124f7) on Avalanche Fuji (43113) |

## How it works

- **The descent is free.** Scroll from the surface through the five real pelagic
  zones — Sunlight, Twilight, Midnight, Abyss, Hadal — with the creatures and
  crewed submersibles that actually operate at each depth. No wallet until you
  hit a gate.
- **Each zone gets equal scroll distance,** so the depth counter accelerates as
  you fall. Near the surface a flick is worth 200 m; in the trench it is worth
  thousands.
- **Gates.** `clear(zone, answer)` checks the answer against a salted hash and
  records the badge on-chain. `skip(zone)` takes the fee and lets you through with no badge.
  Passage is purchasable; the badge is not.
- **Shared progress.** The contract counts, per zone, how many divers earned the
  badge and how many paid. Every gate shows it live.
- **The floor** shows your collection. Bought zones are visibly hollow, and you
  can answer them there to earn the badge after all.

## Why Avalanche

The toll is about one US cent inside a continuous scroll, and the gate has to
open before your thumb stops moving. That needs near-zero fees and finality you
can act on immediately. Avalanche's finality is deterministic and sub-second, so
the gate opens on the receipt and never has to un-open. The site shows the
measured time to finality after every transaction.

## Known limitation

The skip fee is enforced trustlessly. The badge is not yet: the answers are
public in the frontend and a four-option question is brute-forceable against the
stored hash, so a determined user can call `clear()` directly. The fix is
commit–reveal or a signed attestation.

## Stack

Solidity 0.8.24 + Foundry (7 tests) · Next.js 15 · React 19 · ethers v6 ·
TypeScript. No backend, no API keys.

```
contracts/   DepthGate.sol, tests, answer-hash script
web/         the descent (Next.js)
data/        zone, scale and quiz content, with data/SOURCES.md
```

Run locally: `cd contracts && forge install foundry-rs/forge-std && forge test`,
then `cd web && pnpm install && pnpm dev`.

## Data

Every depth, record and vessel figure was checked against published sources:
the 2020 *Limiting Factor* revision of the Challenger Deep (10,935 m ± 6 m),
the 8,336 m snailfish record (Aug 2022), the 6,957 m dumbo octopus (2020), the
2,992 m Cuvier's beaked whale dive, *Alvin*'s 2021 re-certification to 6,500 m,
and others. All wording is original.
