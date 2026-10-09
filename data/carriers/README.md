# Carrier registry — data grades

One JSON file per state: `data/carriers/<STATE>.json`. Each file is an array of
`CarrierRegistryEntry` (`packages/shared/src/types.ts`): `id, name, channel
(direct|agent), statesServed, logo, quotable, notes?, available?, website?`.
Regional carriers also carry `"confidence": "medium"`.

## Data grades

| States | Grade | Meaning |
|--------|-------|---------|
| MA | **full** | Seeded Oct 2026 from real quote research (Allstate $1,347/6mo anchor). 14 carriers incl. agent-only MA cluster (Commerce, Safety, Arbella, Hanover). |
| TX | **full** | Seeded Oct 2026: 11 real TX carriers with honest direct/agent channels (Texas Farm Bureau, Germania). |
| CA, NH | **good** | National core + correct regionals (Wawanesa/Mercury/AAA for CA; Concord Group + Plymouth Rock for NH). |
| All other 46 | **starter** | National core (GEICO, Progressive, Allstate, Liberty Mutual quotable via simulation adapters; State Farm, Farmers, Nationwide, Travelers agent-channel; USAA military-only) + regionals added ONLY where confident (Erie, Auto-Owners, American Family, Mercury, AAA, NJM, Farm Bureaus, NYCM, Concord). Simulation pricing bands are MA-anchored — approximate outside MA (noted per entry). |

## Rules for contributors

- `quotable: true` ONLY when a simulation adapter exists in `apps/api/src/adapters/`
  (geico, progressive, allstate, libertyMutual, plymouthRock, amica). **Never invent
  pricing for a carrier with no adapter** — list it as `quotable: false` and the UI
  degrades to an honest website/agent-directory link.
- When in doubt about whether a carrier serves a state, leave it out. The national
  core alone keeps every state functional.
- Amica does not write auto policies in AK/HI → `quotable: false` there with a note.
- New states: copy the national-core block, add regionals with `"confidence": "medium"`,
  and update this table.
