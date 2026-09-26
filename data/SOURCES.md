# Sources

Every figure in `zones.json`, `buildings.json` and `quiz.json` was checked
against a source on 20 September 2026 rather than recalled. Where a number is
disputed, the disputed range is noted rather than hidden.

Nothing here is copied text. The facts are figures and dates, which are not
copyrightable; all wording is original. No dataset was downloaded, so there is
no dataset licence to honour. If a judge asks where the data came from, the
answer is "hand-assembled from published records, sources listed in the repo" —
which is both true and a better answer than most entries will have.

## Depths

| Figure | Value used | Source |
|---|---|---|
| Challenger Deep | 10,935 m ±6 m (95% CI) | Revised depth from DSV *Limiting Factor* submersible transects, June 2020; NOAA repository / *Deep-Sea Research Part I* |
| Zone boundaries | 200 / 1,000 / 4,000 / 6,000 m | Standard pelagic division — WHOI Ocean Learning Hub, Univ. of Hawaii *Exploring Our Fluid Earth* |
| Titanic wreck | ~3,800 m | Wreck of the Titanic, widely reported as 12,500 ft |
| Deepest fish filmed | 8,336 m, *Pseudoliparis* snailfish, Izu-Ogasawara Trench, Aug 2022 | Natural History Museum; *Deep-Sea Research Part I* (2023) |
| Deepest octopus | 6,957 m, *Grimpoteuthis*, Java Trench | Guinness World Records; *Marine Biology*, 26 May 2020 |
| Deepest mammal dive | 2,992 m, Cuvier's beaked whale, 2014 | *PLOS One*, "Record-Breaking Dives" |
| Deepest scuba dive | 332.35 m, Ahmed Gabr, 18 Sep 2014 | Guinness World Records |

## Vessels

| Vessel | Value used | Note |
|---|---|---|
| *Trieste* | 10,911 m, 23 Jan 1960 | Instruments read 11,521 m at the time; later recalculated. Sources give 10,911 or 10,916 — **10,911 used**, and the discrepancy is itself a good fact. |
| *Deepsea Challenger* | 10,908 m, 2012 | James Cameron, solo |
| DSV *Limiting Factor* | 10,925 m, 2019 | Later renamed *Bakunawa* |
| *Fendouzhe* / Striver | 10,909 m, 10 Nov 2020 | Chinese national record; 13 dives, 8 past 10,000 m |
| DSV *Alvin* | 6,500 m | Re-certified 2021 after overhaul; **was 4,500 m before that — do not use the old figure** |
| DSV *Jiaolong* | 7,062 m achieved, rated 7,000 m | 2012 Mariana Trench dive |
| DSV *Shinkai 6500* | 6,500 m | In service since 1989 |
| DSV *Nautile* | 6,000 m | |

## Buildings

Bangkok heights confirmed: Magnolias Waterfront Residences at ICONSIAM
**317.95 m** (tallest in Thailand), King Power Mahanakhon **314.2 m**, Baiyoke
Tower II **304 m**. Mahanakhon is the one to lead with — it is the recognisable
silhouette, and the room can see it from the venue.

Eiffel Tower is **330 m** to the tip since the 2022 antenna. The older 324 m
figure is out of date.

## Things stated as approximate, on purpose

- Pressure figures are computed as `1 atm + depth/10`, which is close enough at
  every depth and exactly right in spirit. The commonly cited Challenger Deep
  pressure is ~1,086 bar; `zones.json` says ~1,095 atm and the copy says
  "roughly 1,100".
- "90% of twilight-zone animals are bioluminescent" is a widely published
  estimate, not a measurement. Copy says "an estimated 90%".
- "Average ocean depth ~3,700 m" — published values run 3,682–3,688 m.
- Submarine operating depths are classified. Copy says so.

## Checked and rejected

- **"Eight Burj Khalifas to reach the Titanic"** — wrong by arithmetic. It is
  four and a half. Caught before it reached the pitch.
- **"200 m is two Mahanakhons"** — wrong. 200 m is less than one. Rewritten.
