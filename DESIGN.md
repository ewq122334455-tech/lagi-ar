---
version: alpha
name: LAGI-design
description: LAGI's design language — the structural system of Wise's marketing site (tinted surface bands, white rounded cards, one chunky display face, a signature interactive card on the hero, polarity-flipped dark promo bands) translated entirely into LAGI's own palette and Korean-first typography. Nothing of Wise's colour or wordmark survives the translation; what is borrowed is the layout grammar.
derivedFrom: getdesign "wise" template — see docs/design-reference-wise.md for the untouched original.

colors:
  # ─── LAGI brand. Every value below was sampled pixel-by-pixel from the LAGI
  # logo and the supplied colour-chip artwork, not estimated by eye. ───
  primary: "#3278BA"          # blue — 45% of the logo's non-white pixels; the lead colour
  primary-deep: "#2A669E"     # blue x0.85, hover / pressed
  on-primary: "#ffffff"
  ochre: "#C1A252"
  terracotta: "#B76C58"
  sage: "#6BA576"
  mauve: "#AC7B8A"
  slate: "#4E79A2"            # the star mark in the chip artwork
  clay: "#844E3F"             # terracotta darkened so it can carry text on white
  ink: "#111111"
  graphite: "#3a3a3a"
  mute: "#8a8a8a"
  canvas: "#ffffff"
  # ─── Surface tints, mixed from the palette above ───
  canvas-soft: "#ECE8DF"      # ochre at 12% over #f2f2f2 — the warm band
  canvas-cool: "#E6EFF7"      # blue at 12% over white — the cool band
  surface-ochre: "#F0E8D4"    # ochre at 25% over white — soft feature-card fill
  neutral: "#f5f5f5"
  line: "#e5e5e5"

typography:
  display-mega:
    fontFamily: Jua, Nunito, sans-serif
    fontSize: 112px
    lineHeight: 0.86
  display-xl:
    fontFamily: Jua, Nunito, sans-serif
    fontSize: 72px
    lineHeight: 0.9
  display-lg:
    fontFamily: Jua, Nunito, sans-serif
    fontSize: 48px
    lineHeight: 1.05
  heading-lg:
    fontFamily: Nunito, Gothic A1, sans-serif
    fontSize: 24px
    fontWeight: 800
  heading-md:
    fontFamily: Nunito, Gothic A1, sans-serif
    fontSize: 20px
    fontWeight: 800
  body-lg:
    fontFamily: Gothic A1, Nunito, sans-serif
    fontSize: 18px
    lineHeight: 1.65
  body-md:
    fontFamily: Gothic A1, Nunito, sans-serif
    fontSize: 15px
    lineHeight: 1.6
  body-sm:
    fontFamily: Gothic A1, Nunito, sans-serif
    fontSize: 13px
    lineHeight: 1.55
  button:
    fontFamily: Nunito, sans-serif
    fontSize: 15px
    fontWeight: 800
  eyebrow:
    fontFamily: Nunito, sans-serif
    fontSize: 11px
    fontWeight: 700
    letterSpacing: 0.24em
    textTransform: uppercase

rounded:
  none: 0px
  sm: 8px
  input: 12px
  lg: 16px
  card: 24px      # the canonical card + button radius
  pill: 9999px

spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 48px
  band: 96px      # vertical padding on a full-width band
---

## Overview

LAGI's surface is built from **full-width bands** stacked down the page. A band is one of four
surfaces — warm `canvas-soft`, cool `canvas-cool`, plain `canvas`, or the polarity-flipped
`ink` — and white rounded cards sit inside the tinted ones. The contrast between a tinted band
and the white cards on it *is* the elevation; LAGI does not use drop shadows to lift a card.

Display type is the second voice. **Jua** carries every hero and section headline at large
sizes; **Nunito ExtraBold** carries sub-headings, product names and all button labels; **Gothic
A1** carries Korean body copy. The jump from Jua's round display to Nunito's tighter grotesk is
the typographic story, and it mirrors how Wise pairs a chunky proprietary face with a neutral
one.

`rounded.card` (24px) is the one radius that matters — cards, buttons and inputs all take it.
LAGI does not use sharp corners on UI chrome.

**Key characteristics**
- One primary CTA colour: `primary` blue `#2E55A3`. Lime and orange are accents on cards and
  never used as the main action.
- A signature interactive card on the hero. On Wise that card converts currency; on LAGI it is
  the **product configurator** — live 3D, option selection, add-to-cart and AR entry in one card.
- Tinted bands alternate with white ones so the page reads in chapters.
- One dark `ink` band per page at most, for the promotional moment (AR).
- Korean for anything functional or instructional; English only where it works as a brand or
  editorial label (`LOOK CLOSER`, `FEATURED PRODUCTS`, `EXPERIENCE IN AR`).

## Colours

### Brand
- **Blue** `primary` `#3278BA` — every primary button, every link hover, the brand's lead. It is
  the logo's own blue, read straight off the artwork.
- **Ochre** `#C1A252`, **Terracotta** `#B76C58`, **Sage** `#6BA576`, **Mauve** `#AC7B8A` and
  **Slate** `#4E79A2` — the chip palette. Card and detail accents only; never the primary action.

### Contrast rules that follow from the palette
- Blue carries white text at 4.70:1 — above AA, so primary buttons are safe.
- Terracotta carries white at only 3.99:1, so **terracotta surfaces take ink text**, not white.
- Sage carries white at 2.9:1 — ink text only.
- For terracotta-coloured *text* on white, use `clay` `#844E3F` (6.6:1) instead.

### Surfaces
- **Canvas** `#ffffff` — card interiors, and plain content bands.
- **Canvas soft** `#ECE8DF` — the warm band, ochre mixed into a light neutral at 12%.
- **Canvas cool** `#E6EFF7` — the cool band, the logo blue at 12% over white.
- **Surface ochre** `#F0E8D4` — soft feature-card fill, ochre at 25% over white.
- **Ink** `#111111` — the dark band and the footer.

### Text
- `ink` for headings, `graphite` for body, `mute` for captions and unregistered values.

## Layout

- Base unit 4px. Band padding `spacing.band` 96px top/bottom on desktop, 56px on mobile.
- Card interior `spacing.xl` 24px, large cards 32px.
- Content container centres at 1280px; the canvas itself may run wider.
- Hero: split at ≥1024px (headline left, configurator card right), stacked below.
- Feature grids: 3-up desktop, 2-up tablet, 1-up mobile.

## Components

**`Button`** — `variant="primary"` fills `primary` with white text; `secondary` fills
`canvas-soft` with ink text; `tertiary` is white with a 1px ink border; `dark` fills ink with
white text. All take `rounded.card`, `typography.button`, 14px/24px padding.

**`Card`** — white, `rounded.card`, 24px padding, no shadow, no border. `tone="lime" | "cool" |
"dark"` swaps the fill, and `dark` flips text to white.

**`Band`** — full-width section wrapper. `tone="soft" | "cool" | "plain" | "dark"`, vertical
padding `spacing.band`.

**`Stat strip`** — a row of counted facts under the hero. Every number must come from real data;
a fact LAGI has not been given is shown as `정보 미등록`, never estimated.

**`Accordion`** — FAQ rows. Renders the `CONTENT_REQUIRED` state when no answer has been
supplied rather than inventing one.

## Do's and Don'ts

### Do
- Put white cards on tinted bands; let surface contrast carry the depth.
- Keep one blue CTA per view as the obvious next action.
- Use Jua only at display sizes — it loses legibility as body copy, especially in Korean.
- Show `정보 미등록` where the brand has supplied nothing.

### Don't
- Don't import Wise's lime `#9fe870` or sage `#e8ebe6`. The structure is borrowed; the colour is not.
- Don't put white text on terracotta or sage — both fall below AA. Ink text, or `clay` on white.
- Don't add drop shadows to lift cards.
- Don't put more than one dark band on a page.
- Don't fabricate a price, material, dimension or review to fill a layout.
