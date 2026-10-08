<div align="center">

<img src="https://raw.githubusercontent.com/Mnemosyne-OS/Mnemosyne-Neural-OS/main/assets/banner-mnemosyne-os.png" width="100%" alt="Mnemosyne OS — Your memory. Your machine. Your rules." />

🌐 [**mnemosyne-os.io**](https://mnemosyne-os.io) — the product&ensp;·&ensp;[**mnemosyne-os.com**](https://mnemosyne-os.com) — for organizations&ensp;·&ensp;📖 [**docs.mnemosyne-os.io**](https://docs.mnemosyne-os.io) — the documentation

</div>

# MnemoClio

The history of every country on one timeline you can move.

Drag the timeline to travel through time. The wheel zooms from five centuries down to five
years. Press play and the cursor runs: what it passes lights up on the timeline and on the
map, and lands in the feed. Click anything to open its card, with what happened the same
year in every other country.

## What is on it

- 197 countries, each name in the language of its country, with French names on request.
- Regimes and their successions, wars with their fronts and battles, and the great periods
  that contain several wars.
- About 20 700 events in eleven subjects: births, works, discoveries, knowledge (universities,
  museums, libraries, newspapers), buildings, treaties, revolts, disasters, exploration,
  movements and sport.
- A map that follows the cursor, with today's borders, or the borders of the time after you
  agree to download them.

## Sources and licences

| Data | Licence | How it gets here |
|---|---|---|
| Wikidata | CC0 | read by `scripts/wikidata/`, shipped in `public/data/` |
| Natural Earth (today's borders) | public domain | shipped in `public/data/world-today.json` |
| historical-basemaps by A. Ourednik (borders of the time) | GPL-3.0 | **not shipped**: your computer downloads each date from GitHub after you agree |

The date the data was read is printed at the bottom of the window.

Some subjects are capped to the best known items, and the window says so. Births, for
example, are the 6 000 best known of 13 031, meaning people with at least 59 Wikipedia
articles. A country with few events on the timeline has few on Wikidata, which does not mean
it had little history.

## Rebuilding the data

```bash
node scripts/wikidata/build-data.mjs
```

It takes about 40 minutes and makes about 2 000 calls to Wikidata, with no key. `--split`
only redoes the last step (cache to `public/data`). The order of the steps matters. It is
written in `build-data.mjs`.

## Not done yet

- Writing what you look at into your memory (a vault per country) is the next lot.
- Names with no French name on Wikidata stay in their own language. A translation by a model,
  paid by the person, is planned and not wired.
- Causes ("this war led to that treaty") are not drawn: Wikidata holds almost none.

Architecture: `docs/architecture/137_mnemoclio-history-timeline.md`.

## Where Mnemosyne OS lives

This cartridge runs inside **Mnemosyne OS**, the sovereign, local-first memory operating system published by XPACEGEMS LLC. Its official addresses:

- Product site: <https://mnemosyne-os.io>
- Organizations: <https://mnemosyne-os.com>
- Documentation: <https://docs.mnemosyne-os.io>
- Host source: <https://github.com/Mnemosyne-OS/Mnemosyne-Neural-OS>
- Packages: the npm scope `@mnemosyne_os`

---

<sub>**[Mnemosyne OS](https://mnemosyne-os.io)** — the sovereign, local-first memory OS this cartridge runs in.
Get it at [mnemosyne-os.io/download](https://mnemosyne-os.io/download), install cartridges from the built-in MnemoHub store, or [build your own](https://mnemosyne-os.io/dev).</sub>
