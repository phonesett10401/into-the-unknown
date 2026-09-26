import zonesData from "@/lib/zones.json";

export type Info = { name: string; meta: string; note: string; url: string };

const W = "https://en.wikipedia.org/wiki/";
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

// The data file keeps plain ASCII keys; these are how the names should read.
const DISPLAY: Record<string, string> = {
  "Portuguese man o war": "Portuguese man o' war",
  "Cuviers beaked whale": "Cuvier's beaked whale",
};

/** Everything a callout can show, keyed by the name used in the zone data. */
export const INFO: Record<string, Info> = {};

for (const z of zonesData.zones) {
  for (const c of z.creatures) {
    INFO[c.name] = {
      name: DISPLAY[c.name] ?? c.name,
      meta: `${c.scientific}, ${fmt(c.from)} to ${fmt(c.to)} m`,
      note: c.note,
      url: c.url,
    };
  }
  for (const v of z.vessels) {
    INFO[v.name] = {
      name: DISPLAY[v.name] ?? v.name,
      meta: [`${fmt(v.depth)} m`, v.year, v.nation !== "-" ? v.nation : null].filter(Boolean).join(", "),
      note: v.note,
      url: v.url,
    };
  }
}

// Things built in the ocean that have no card in the zone data.
Object.assign(INFO, {
  Sardines: {
    name: "Sardines",
    meta: "Schooling fish, surface waters",
    note: "Under attack, a school packs into a tight spinning bait ball, so no single fish is easy to pick out.",
    url: W + "Sardine",
  },
  Jellyfish: {
    name: "Jellyfish",
    meta: "Cnidaria, surface to trench",
    note: "No brain, no heart, no bones, and drifting through the oceans for more than 500 million years.",
    url: W + "Jellyfish",
  },
  Siphonophore: {
    name: "Siphonophore",
    meta: "Siphonophorae, twilight and midnight zones",
    note: "Not one animal but a colony of clones, each doing one job. Some grow longer than a blue whale.",
    url: W + "Siphonophorae",
  },
} satisfies Record<string, Info>);
