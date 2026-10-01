# ADR 0009: The "operator terminal" redesign

- **Status:** Accepted, 2026-09-30
- **Deciders:** the owner (a mockup of the landing and chat pages: "mirror this new design and aesthetic,
  while maintaining the current format of the visualizer"; free rein on styling, layout changes confirmed
  first), and Claude for the details

## Context
The owner supplied a generated mockup of the landing page and the chat page. Its look: framed header and
footer bars, near-square corners, thin phosphor-green borders with a faint glow, a filled green primary
button, uppercase monospace headings, and token chips as separate boxes. The owner approved these layout
changes when asked:
- **Landing:** a hero graphic, three feature cards, and header and footer bars. The header holds Settings
  and Privacy only. (Update, 2026-10-01: the owner added an FAQ link to every header; see ADR 0010.)
- **Chat:** keep the split (chat about 38%, walkthrough about 62%) and restyle it. Messages get avatars and
  name headers. The composer gets an example hint.

## Decisions

### Palette and labels (`src/app/styles/tokens.css`)
- **New label hues, from the mockup:**

  | Label | Before | Now |
  |---|---|---|
  | Recorded | green | green |
  | Calculated | cyan | cyan |
  | Reference | amber | blue |
  | Example | violet-grey | orange |

  The shape cues are unchanged: a solid outline and a dot for Recorded, a dotted underline and ƒ for
  Calculated, a double border and a book for Reference, a dashed outline and ◌ for Example. The label word
  is always shown.
- **Green is also the accent.** It fills the primary buttons and the option bars, and outlines highlighted
  tokens. So labels are told apart by their word, glyph, and border, never by hue (CLAUDE.md L6). Section
  titles use a "▸" caret rather than a dot, because "●" is the Recorded glyph.
- **Contrast checks** (`tokens.test.ts`) now also cover the accent used as text (links), and the ink on
  filled accent buttons. The light theme's accent was darkened slightly (to `#0b7032`) to pass on token
  backgrounds.

### Components
- **Buttons:** outlined by default. The primary one is filled green with dark ink. A disabled primary
  button turns outlined and dim, so it doesn't look like an invitation.
- **Panels, the stage, and the walkthrough's cards:** strong borders, a faint glow, and 4 px corners
  (2 px on small parts).
- **Tokens and picks:**
  - Token chips are separate boxes.
  - A highlighted token gets a green outline, a tint, and an underline.
  - "Picked" is a filled green tag, so it can't be mistaken for an outlined label badge.
  - The weighted strip's picked segment is filled bright, with dark ink.

### Landing page (`src/app/page.tsx`, `landing-graphics.tsx`, `landing-data.ts`)
- **Header and footer bars.**
- **The hero** puts the pitch beside a real next-token moment. The data is the sample's first reply at its
  first spread-out position:

  | Option | Chance |
  |---|---|
  | " air" (picked) | 40.3% |
  | " as" | 40.3% |
  | " Earth" | 15.9% |
  | " when" | 2.04% |

  - The mockup's made-up numbers were replaced with these real values, each shown through `<Datum>` (L3).
  - The legend names the labels, and when and with which model the sample was recorded.
  - The curves from the text to the options are identical for every option. They mean only "one of these
    comes next", and never attention (A10).
- **Three numbered feature cards,** each built from the sample's data:
  - **Tokens:** the first question, as tokens with their IDs.
  - **A weighted random pick:** a pick that wasn't the top option (" enhance", rank 3, 16.2%).
  - **Context, not memory:** the four parts the second request carried, with their token counts.

  Each card links to `/sample`.
- **The label key and the rain.** The label key is kept. The rain stays a full-page background, as the
  owner asked earlier (ADR 0008). The mockup shows rain only around the hero; moving it would be a layout
  change for the owner to decide.

### Chat page
- **Messages:**
  - Each has an avatar: a person for "You", and a neutral chip for "Assistant", never a provider's logo.
  - The name header is the message's heading. The reply's heading carries its Recorded chip, and
    screen-reader text adds the turn number and "reported by OpenAI".
  - On phones the avatars are hidden, to save width.
- **The composer:** the hint reads "Ask a question… (e.g. “Why is the sky blue?”)". Send has an arrow.
- **Before the first reply,** the walkthrough panel shows four numbered steps, each with the labels of the
  values it shows:
  1. Your message (Recorded)
  2. Text becomes tokens (Calculated)
  3. Next-token choices (Calculated, and Example for the network drawings)
  4. The reply is built (Recorded)

### Decorative marks
Step numbers, arrows, the "▸" caret, and the "//" before the eyebrow are CSS generated content with empty
alternative text (`content: "…" / ""`). Lists and headings already give screen readers the structure.

## Consequences
- **Tests:**
  - 214 unit tests, including the added contrast checks.
  - 44 end-to-end tests. The new ones check the landing's graphics (numbers only as labeled values), the
    message headings, and the four steps.
  - axe passes on every page checked.
- **Claims register:** C055 (the top option isn't always picked) is new. The landing and the new empty
  state were added to the "where" of C018, C022, C027, and C036. The landing no longer makes claim C039.
- **Plan updates:** `docs/PLAN.md` §2's label table and palette are updated to these hues.
