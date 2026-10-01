# ADR 0010: The FAQ page

- **Status:** Accepted, 2026-09-30
- **Deciders:**
  - The owner asked for a FAQ "that answers the most frequently asked simple questions about AI". They named four questions: the black box, AI "going rogue", whether images and video are made the same way, and how impactful the technology is.
  - Claude chose the other questions and wrote the answers.

## Context
The site teaches how a reply is generated, but visitors bring broader questions about AI. The owner asked
for a page answering them simply. This site's accuracy rules (CLAUDE.md §3) apply to every page,
"marketing pages" included, so the FAQ has to meet the same standard as the walkthrough.

## Decisions

### The page (`/faq`, static)
- **Twelve questions in three sections:**
  - **How it works:**
    - AI vs. machine learning vs. LLMs
    - where knowledge comes from, and whether it looks things up
    - confident false statements
    - different answers to the same question
    - learning from conversations
    - images, video, and voice
  - **Inside the black box:**
    - the black box
    - asking a model to explain itself
    - whether it understands
    - whether it's conscious
  - **Risks and impact:**
    - going rogue
    - how impactful it really is
- **Each answer has:**
  - an "In short" line;
  - a few paragraphs;
  - where it applies, a link into the sample;
  - its sources, each with its publication date.
- **Layout.** On wide screens, a sticky list of the questions sits beside the answers. On narrow screens it sits above them. Each answer has its own anchor (`/faq#black-box`).
- **Header and footer.** The page uses the landing page's header and footer bars, now shared components (`src/components/site/`).
  - The footer links to the FAQ.
  - **Update, 2026-10-01 (owner):** every header bar links to it too, on the landing, chat, sample, and FAQ pages, between Settings and Privacy. On the FAQ itself, the link is marked as the current page.
- **Settings loads saved preferences itself.** Before this, a page that showed Settings without loading preferences could overwrite saved choices.

### Same rules as the walkthrough's copy
- **Wording.** The model's verbs stay plain, and the content lint covers the new copy. It allows two exceptions:
  - the popular term "hallucinations", where the FAQ names and explains it;
  - the title and address of OpenAI's paper that uses the word.
- **Claims.** Every answer lists the claims it rests on. C056 to C088 are new, and 14 existing claims now also note the FAQ in their "where".
- **No bare numbers.** Every figure is a Reference value, with its document and the date it was checked, shown through `<Datum>` with its badge.
  - Answers avoid bare years and model version numbers; citation dates in the source lists are exempt.
  - A new `percent` format shows a documented percentage as the source states it ("14%", not "14.0%").
- **One exception to "only src/trace mints labels".** `src/content/faq-facts.ts` mints Reference values, and only with a document (title, URL, and retrieval date).
  - Lint now covers `src/content` and allows minting only in that file.
  - CLAUDE.md §4 records the exception.

### Sources (checked 2026-09-30)
Five research passes checked every figure against its primary source. Corrections that changed the copy:
- **Customer support** (Brynjolfsson, Li & Raymond): the published journal figures are used (15% on average, 30% for the least experienced). The 2023 working paper reported 14% and 34%.
- **The developer trial** (METR, 19% slower): METR now marks this result out of date. It believes developers are likely sped up today, but calls its newer data weak evidence. The FAQ says both.
- **Sora** is described in the past tense; OpenAI has discontinued it.
- **Autoregressive images.** OpenAI calls only GPT-4o's image generation autoregressive, and has disclosed no architecture for its later image models.
- **"Going rogue".** The FAQ follows the International AI Safety Report 2026: current systems show early signs of the relevant abilities, but not at levels that would allow a loss of control.
  - The test results it cites (Apollo Research, Palisade Research, Anthropic) are described as contrived scenarios, as their authors describe them.

## Consequences
- **Tests:**
  - Unit tests check every answer's anchor, claims, and sources, and that its numbers are labeled. Every documented figure must be a Reference value, and every one must be used.
  - An end-to-end test checks that the question list links every answer, that every answer cites sources, that numbers appear only as labeled values, and that axe finds no serious violations.
- **Upkeep.** The adoption, jobs, energy, and research figures change quickly, so the page states its check date at the top. Re-check the sources before relying on them, and update `FAQ_CHECKED` and each claim's `checked` date.
