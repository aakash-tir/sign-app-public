# Reaching 100 published signs

> **✅ DONE (P4M16, 2026-06-16): 106 published signs.** The MS-ASL download (Part 2)
> delivered — 36 everyday glosses fetched, a 117-gloss model trained, and the honest gate
> cleared **27 new signs → 79 + 27 = 106 published** (aggregate 0.696 over 117; the
> original 79 hold at 0.718; no demotions). recognition.md §6.14. This guide is kept for
> reproducibility / the next expansion.

Goal: **100 dynamic signs published at ≥ 50% honest accuracy** (signer-disjoint
cross-validation top-1, ADR-019). Starting point: **79 published** (model P4M10, honest
aggregate 0.732).

There are two parts, run in parallel:

1. **On-disk expansion (free, automated — P4M15).** Tested the 19 WLASL glosses already
   on disk that meet the data floor. **Result: explored, not shipped.** On the honest
   gate only **`bed` (0.54, n=13)** of the 19 cleared 0.50; the rest fell well below
   (`cool` 0.00 … `cousin` 0.43) and the overall aggregate dropped 0.732 → 0.704. The
   existing 79 held (0.731 over them — no regression), but shipping a 100-class model for
   one borderline sign isn't worth it. **The on-disk data is simply too thin** (12–16
   clips/gloss), exactly as the pre-screen predicted. The vocab wiring (`vocab100`) is
   kept as tooling. → So the download below is the real path to 100.
2. **MS-ASL download (this guide — owner action).** The reliable +data lever (it added 57
   glosses in the vocab50 push). Fetches **36 high-coverage everyday glosses** so enough
   clear the gate to reach 100.

The on-disk pool is thin (only 19 WLASL glosses have ≥ 12 local clips, none ≥ 20), so it
gets us **partway**; the download closes the gap.

## The 36 download glosses

All have **≥ 43 MS-ASL clips** already in the annotations (good signer diversity → likely
to clear the gate), none overlap the current 100. Defined as `DOWNLOAD_GLOSSES` in
`ml/src/sign_ml/wlasl.py`:

- **Colours:** orange, yellow, blue, red, green, brown, pink, purple
- **People:** grandmother, grandfather, nurse
- **Nouns:** fish, table, paper, apple, cat, shoes, bus, home, pencil, sandwich
- **States:** sick, beautiful, hurt, slow, wrong, same, lost
- **Time:** spring, night, time
- **Verbs:** dance, draw, live, meet, sign

We over-provision on purpose: the honest ≥ 0.50 gate culls a chunk, so 36 fetched should
net the ~21 needed to reach 100.

## Step 1 — Download the clips (owner)

This is the throttled YouTube fetch. The setup gotchas (cookies, ffmpeg) are recorded in
the memory `msasl-download-setup`; the essentials:

1. Export a **`cookies.txt`** for youtube.com — using the **"Get cookies.txt LOCALLY"**
   extension **while on a youtube.com tab and logged in** (Chrome's App-Bound-Encryption
   breaks `--cookies-from-browser`). If the file ends up tiny/empty, you weren't on a
   youtube.com tab — re-export.
2. **Install Deno once** (one-time, no admin): in PowerShell run
   `irm https://deno.land/install.ps1 | iex`. YouTube now requires solving a JavaScript
   "n challenge" to return real video formats; without a JS runtime yt-dlp only sees
   storyboard images (`Requested format is not available`). Deno is the runtime yt-dlp
   uses for this (our `node` 20 is too old; it needs ≥ 23.5). The download script
   auto-finds Deno at `~/.deno/bin`. ffmpeg is already handled (bundled `imageio-ffmpeg`).
3. Run the fetch for the **`download`** vocab:

   ```sh
   cd ml && uv run python -m sign_ml.msasl_download --vocab download --cookies path/to/cookies.txt
   ```

   Expect **YouTube throttling** — last time it needed a few 75-minute-cooldown retry
   passes. Re-run the same command; it's resumable (skips clips already present). Some
   links rot, so realized coverage will be a bit below 43/gloss — still plenty.

## Step 2 — Extract + retrain + gate (automated, after the download)

Once the clips are on disk, the rest is the same pipeline as every prior expansion:

```sh
cd ml
# 1. extract the new glosses' landmarks (resumable; only the new clips are processed)
uv run python -m sign_ml.dynamic_pipeline extract-combined --vocab vocab136 --out models/combined
# 2. reassemble the cache for all 136 glosses
uv run python -m sign_ml.dynamic_pipeline assemble-combined --vocab vocab136 --out models/combined
# 3. honest gate — how many of the 136 clear 0.50
uv run python -m sign_ml.dynamic_pipeline crossval --cache models/combined --aug \
    --pooling attention --bidirectional --label-smoothing 0.15
```

Then I bundle the model: re-gate `SHIPPED_GLOSSES` to the words ≥ 0.50, retrain + calibrate
(`train` + `calibrate` with the same flags), copy `model.onnx`/`metadata.json` into
`frontend/public/models/dynamic/`, generate the new reference clips, update tests, and
regenerate `docs/sign-language-accuracy.xlsx`. Methodology: `.claude/docs/recognition.md`.

> **Just tell me when the download is done** and I'll run steps 1–3 and ship whatever
> clears the gate, repeating with a few more glosses if we land just short of 100.
