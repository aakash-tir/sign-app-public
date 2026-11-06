# Graph Report - open-source-prep  (2026-11-05)

## Corpus Check
- 336 files · ~173,523 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1735 nodes · 2958 edges · 185 communities (112 shown, 73 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 199 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `34db9d28`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 64
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 91
- Workflow rules — issues, git, PRs, CI, quality gates
- mediapipeDetector.ts
- package_name
- P4M1 — Sign search tab
- Python rules — ML pipeline
- Backlog
- pull_request_template.md
- Sign App
- .prettierrc.json
- Reaching 100 published signs
- feature.md
- sign-ml
- gradlew
- now.json
- classify_low_signs
- React + TypeScript + Vite
- bug.md
- graphify-guard.sh
- deny
- ExampleUnitTest
- tsconfig.json
- load_class_list
- 2026-11-03
- 2026-11-05
- CLAUDE.md
- run_all.sh
- Test
- Test
- FloatArray
- IntArray
- Any
- Path
- Any
- FloatArray
- NDArray
- Path
- str_
- FloatArray
- NDArray
- ArrayLike
- FloatArray
- Any
- Path
- Any
- FloatArray
- IntArray
- Any
- Path
- Any
- FloatArray
- IntArray
- Path
- Any
- Protocol
- Any
- ArrayLike
- Any
- Path
- Path
- ArrayLike
- FloatArray
- Any
- Path
- Path
- Protocol
- Path
- Any
- FloatArray
- Path
- Path
- Path
- Path
- IntArray
- Path
- ndarray
- Any
- ndarray
- Path
- Any
- Path
- Any
- FloatArray
- IntArray
- NDArray
- str_
- Any
- Path

## God Nodes (most connected - your core abstractions)
1. `WordBankRepo` - 40 edges
2. `Decision Log (ADRs)` - 32 edges
3. `useDynamicSignRecognition` - 30 edges
4. `SignAppDB` - 28 edges
5. `useUnifiedSignRecognition` - 21 edges
6. `compilerOptions` - 20 edges
7. `6. The central risk: word-level accuracy` - 19 edges
8. `compilerOptions` - 18 edges
9. `cross_validate()` - 17 edges
10. `CurriculumRepo` - 15 edges

## Surprising Connections (you probably didn't know these)
- `test_sanitize_replaces_unsafe_chars()` --calls--> `_sanitize()`  [INFERRED]
  ml/tests/test_pipeline.py → ml/src/sign_ml/dynamic_pipeline.py
- `test_pipeline_trains_and_exports()` --calls--> `run_synthetic_pipeline()`  [INFERRED]
  ml/tests/test_pipeline.py → ml/src/sign_ml/pipeline.py
- `unit()` --indirect_call--> `curriculumSetOf()`  [INFERRED]
  frontend/src/content/curriculum.ts → frontend/src/domain/curriculum.ts
- `HolisticResultLike` --references--> `Landmark`  [EXTRACTED]
  frontend/src/recognition/holisticDetector.ts → frontend/src/recognition/types.ts
- `build_baseline()` --calls--> `build_sequence_model()`  [INFERRED]
  ml/experiments/bakeoff/common.py → ml/src/sign_ml/dynamic_model.py

## Import Cycles
- None detected.

## Communities (185 total, 73 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.14
Nodes (25): _load_holistic_detector(), Clip, One WLASL clip instance for one gloss., capture_raw_frames(), export_references(), Path, Export compact landmark-animation reference clips for the shipped dynamic glosse, A flat MediaPipe landmark list → ``[[x, y], ...]`` rounded, or ``None``. (+17 more)

### Community 1 - "Community 1"
Cohesion: 0.17
Nodes (21): OverlayColorMode, drawHand(), drawHolistic(), drawPose(), POSE_CONNECTIONS, FINGER_PALETTE, inFrame(), makeObservation() (+13 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (43): confused(), letters(), load_runs(), main(), paired(), Aggregate every run into ml/experiments/results.json (issue #64). Pure read of m, mean ± std across all (seed, fold) runs, plus the std of the per-seed means, Top-10 confused pairs, counts averaged over the 3 seeds (each seed predicts (+35 more)

### Community 3 - "Community 3"
Cohesion: 0.17
Nodes (15): evaluate(), Evaluation metrics for the fingerspelling classifier., Return overall and per-class accuracy on ``(x, y)``., model_to_dict(), Export a trained MLP to plain JSON weights for the frontend.  The frontend runs, save_model_json(), main(), CLI: train the fingerspelling model and export it for the frontend.  uv run pyth (+7 more)

### Community 4 - "Community 4"
Cohesion: 0.14
Nodes (12): ADR-0005, ADR-0029, SignAppDB, ADR-0028, ADR-0029, SentenceRepo, ADR-0028, CurriculumSetProgress (+4 more)

### Community 5 - "Community 5"
Cohesion: 0.22
Nodes (11): ADR-0010, spellableWords(), nextSentencesUnlocked(), sentencesEnabled(), ADR-0009, Level, confidentIds(), defaultRepo (+3 more)

### Community 6 - "Community 6"
Cohesion: 0.05
Nodes (61): _extract_worker(), Persistent worker body (spawned): pull ``(npy_path, video_path)`` jobs, extract, extract_clip(), extract_dataset(), _landmarks_or_none(), normalize_clip(), Turn WLASL video clips into fixed-length normalized landmark sequences.  The Med, Extract all clips → ``(N, window, F)`` features, ``(N,)`` labels, ``(N,)``     s (+53 more)

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (32): ADR-001 — Sign language: ASL, ADR-002 — Recognition: landmark-based, on-device, ADR-003 — Delivery: PWA-first, single React + TS codebase, ADR-004 — Python is build-time only (hybrid stack), ADR-005 — Local-first persistence (IndexedDB), ADR-006 — Hosting: Cloudflare Pages, ADR-007 — MVP recognition scope = fingerspelling + curated signs, ADR-008 — Practice attempt resolution: deferred commit (no revert) (+24 more)

### Community 8 - "Community 8"
Cohesion: 0.20
Nodes (12): App(), defaultRepo, emit(), getDevMode(), listeners, loadDevMode(), setDevMode(), subscribe() (+4 more)

### Community 9 - "Community 9"
Cohesion: 0.05
Nodes (51): ADR-0007, ADR-0015, ADR-0019, ADR-0030, shippedLabels(), ADR-0017, SIGN_SYNONYMS, canFingerspell() (+43 more)

### Community 10 - "Community 10"
Cohesion: 0.15
Nodes (15): ADR-0009, applyOutcome(), ADR-0008, rememberRecent(), selectNextWord(), bankOf(), word(), AttemptOutcome (+7 more)

### Community 11 - "Community 11"
Cohesion: 0.15
Nodes (24): CurriculumSet, avoidLast(), confirmTaught(), dueNewSigns(), nextRecallPrompt(), RecallPhase, recallProgress(), RecallPrompt (+16 more)

### Community 12 - "Community 12"
Cohesion: 0.22
Nodes (10): all_pool_glosses(), Every gloss available across both raw indices — the entire on-disk pool for, Map a ``--vocab`` name to its gloss list. ``pretrain`` is computed live from the, resolve_vocab(), Tests for the synthetic training pipeline and the export schema., test_clip_cache_path_namespaces_by_source_and_sanitizes(), test_pipeline_trains_and_exports(), test_resolve_vocab_pretrain_unions_all_on_disk_glosses() (+2 more)

### Community 13 - "Community 13"
Cohesion: 0.08
Nodes (25): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+17 more)

### Community 14 - "Community 14"
Cohesion: 0.11
Nodes (27): augment_sequences(), drop_landmarks(), Zero individual landmarks (their whole ``x,y,z`` triplet) per frame with     pro, Rotate every landmark's ``(x, y)`` by a small **per-sample** angle (``z`` and, Per-sample speed warp: resample frames on a rate-warped timeline **anchored, Augment a batch of ``(B, T, F)`` windows — the main lever for the tiny     curat, rotate_xy(), time_warp() (+19 more)

### Community 15 - "Community 15"
Cohesion: 0.08
Nodes (35): SIGN_SENTENCES, ADR-0009, ADR-0012, ADR-0028, eligibleSentences(), LEVEL_LENGTH_BANDS, pickSentence(), sentenceOf() (+27 more)

### Community 16 - "Community 16"
Cohesion: 0.08
Nodes (23): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+15 more)

### Community 17 - "Community 17"
Cohesion: 0.07
Nodes (29): Acceptance, Acceptance, Acceptance, Conventions (unchanged from phases 1–2), Dataset review log (owner-provided candidates, 2026-05-24), Dataset sourcing & review (owner-curated), Deliverables, Deliverables (+21 more)

### Community 18 - "Community 18"
Cohesion: 0.06
Nodes (31): 1. The core problem & the chosen approach, 2. Landmark extraction: MediaPipe Tasks Vision, 3.1 Static signs (MVP) — fingerspelling / held handshapes, 3.2 Dynamic signs — word-level, 3. Classifier design, 4. Datasets, 5.1 Dynamic frame normalization — **frozen (M6.1)**, 5. Normalization spec (shared TS ↔ Python) (+23 more)

### Community 19 - "Community 19"
Cohesion: 0.06
Nodes (30): 1. The shape of the system, 2. The tech stack, 3. Repository layout, 4. End-to-end data flow, 5. The two recognition paths, side-by-side, 6. The boundary between deterministic logic and the model, 7. Hosting in one paragraph, Architecture (+22 more)

### Community 20 - "Community 20"
Cohesion: 0.04
Nodes (47): devDependencies, @capacitor/cli, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, fake-indexeddb (+39 more)

### Community 21 - "Community 21"
Cohesion: 0.12
Nodes (28): PRIORITY_WORDS, EXPECTED_PLACEHOLDERS, recognized, route, routeWords, ADR-0029, unit(), WORD_UNITS (+20 more)

### Community 22 - "Community 22"
Cohesion: 0.27
Nodes (10): Activation, classify(), dense(), MlpLayer, MlpModel, relu(), runModel(), softmax() (+2 more)

### Community 23 - "Community 23"
Cohesion: 0.12
Nodes (13): LETTER_BATCHES, CurriculumRepo, Rng, PracticeSession, AlphabetPathViewProps, ALPHABET, defaultCurriculumRepo, LearnerHome() (+5 more)

### Community 24 - "Community 24"
Cohesion: 0.10
Nodes (19): 1. The shape of "deployment" for this app, 2. What `npm run build` actually does, 3. The PWA part, 4. Where it actually lives: Cloudflare Workers Static Assets, 5. CI: what gets checked before merge, 6. The full path: from commit to deployed PWA, 7. What we deliberately don't use, 8. Local development (+11 more)

### Community 25 - "Community 25"
Cohesion: 0.31
Nodes (9): BoolArray, _carve(), Boolean train/val/test masks from WLASL split labels, with fallbacks for     the, Move a deterministic ``frac`` of the True positions of ``mask`` into a new     m, resolve_splits(), _partition_ok(), test_resolve_splits_carves_when_all_train(), test_resolve_splits_promotes_val_when_no_test() (+1 more)

### Community 26 - "Community 26"
Cohesion: 0.06
Nodes (32): dependencies, @capacitor/android, @capacitor/core, dexie, @mediapipe/tasks-vision, onnxruntime-web, react, react-dom (+24 more)

### Community 27 - "Community 27"
Cohesion: 0.17
Nodes (11): { chromium }, files, here, manifest, manifestPath, mlpBundle, ortDist, outDir (+3 more)

### Community 28 - "Community 28"
Cohesion: 0.09
Nodes (26): confusion_matrix(), cross_validate(), distinct_signers_per_class(), fit_per_sign_thresholds(), fit_temperature(), mean_hand_presence_per_class(), Dynamic-sign sequence model: a small GRU over windowed landmark features.  PyTor, Assign each sample to one of ``k`` folds, balanced per class. Returns a     per- (+18 more)

### Community 29 - "Community 29"
Cohesion: 0.12
Nodes (19): _clip_from_entry(), load_msasl_index(), MsaslAdapter, MsaslClip, MS-ASL dataset adapter (Phase 3 / P3M2).  MS-ASL (Microsoft, ~1000 signs / ~25k, Flatten the ``MSASL_{split}.json`` files present under ``data_dir`` into a     l, MS-ASL as a :class:`~sign_ml.ingest.DatasetAdapter`: emits the clips whose     *, One MS-ASL annotated clip (a segment of a YouTube video). (+11 more)

### Community 30 - "Community 30"
Cohesion: 0.20
Nodes (12): ADR-0022, normalizeFrame(), normalizePose(), L_SHOULDER_POS, R_SHOULDER_POS, withMotion(), zeros(), HolisticObservation (+4 more)

### Community 31 - "Community 31"
Cohesion: 0.12
Nodes (15): Architecture Diagram Skill, Auto-layout scaffold (local extension v1.2), Color Palette, Component Box Pattern, Design System, Export Toolbar (built-in), Info Card Pattern, Layout Structure (+7 more)

### Community 32 - "Community 32"
Cohesion: 0.16
Nodes (15): CameraContext, CameraContextValue, CameraStatus, TestConsumer(), ADR-0018, useCameraContext(), CameraProvider(), defaultRepo (+7 more)

### Community 33 - "Community 33"
Cohesion: 0.12
Nodes (30): _build_combined_samples(), Deterministic merged + signer-disjoint-split sample list for the combined     da, assign_signer_disjoint_splits(), CanonicalSample, coverage_by_label(), DatasetAdapter, main(), merge() (+22 more)

### Community 34 - "Community 34"
Cohesion: 0.14
Nodes (22): _clip_cache_path(), _clip_skip_path(), _load_encoder_state(), main(), CLI: build the curated-starter dynamic-sign model end to end.  Two cached, indep, Filesystem-safe token for a per-clip cache filename., Per-clip landmark cache path (resumable extraction, P3M2). Keyed by source +, Sentinel marking a clip that hung/crashed MediaPipe and was quarantined, so a (+14 more)

### Community 35 - "Community 35"
Cohesion: 0.14
Nodes (14): 10. Honest caveats — read this part, 11. Where to read deeper, 1. The problem in one sentence, 2. Two families of approach — and which we picked, 3. MediaPipe: the landmark tracker, 4.1 Static signs — fingerspelling (letters), 4.2 Dynamic signs — words, 4. The classifiers (+6 more)

### Community 36 - "Community 36"
Cohesion: 0.18
Nodes (14): assign_columns(), endpoint(), esc(), group_chain(), layout(), main(), Node, (cx, cy, left, right, top, bottom, column) for a node OR group id. (+6 more)

### Community 37 - "Community 37"
Cohesion: 0.25
Nodes (12): db, defaultRepo, LEVELS, SettingsView(), defaultRepo, emit(), getOverlayColorMode(), listeners (+4 more)

### Community 38 - "Community 38"
Cohesion: 0.29
Nodes (10): band_label(), build_rows(), main(), Generate ``docs/sign-language-accuracy.xlsx`` — the per-word recognition-accurac, The deployed glosses, parsed from the frontend source of truth.      Matches ``S, Plain-text tier so the colour band is meaningful when printed / colour-blind., read_shipped(), write_data_sheet() (+2 more)

### Community 40 - "Community 40"
Cohesion: 0.13
Nodes (15): Conventions, Dependency graph, M0 — Foundation & tooling, M1 — Camera + hand-tracking foundation, M2 — Recognition pipeline: fingerspelling MVP, M3 — Word bank & domain logic (Practice core, no UI), M4 — Practice mode UI, M5 — Learn mode + levels + curriculum (+7 more)

### Community 41 - "Community 41"
Cohesion: 0.13
Nodes (14): 1. High-level shape, 2. Tech stack, 3. Repository layout (monorepo), 4. Recognition data flow (runtime), 5. Data model (local-first, IndexedDB via Dexie), 6. Practice selection algorithm, 7. Offline & PWA, 8. Hosting (+6 more)

### Community 42 - "Community 42"
Cohesion: 0.13
Nodes (15): 1. Goal, 2. Locked decisions (plan.md §6, owner, 2026-07-10), 3. Milestones, 4. Risks / watch items, 5. Checklist, P6M1 — Syllabus + reconciliation (content + pure domain), P6M2 — Store-wrap feasibility spike (early — de-risks Q1), P6M3 — Recall engine (pure domain) (+7 more)

### Community 43 - "Community 43"
Cohesion: 0.13
Nodes (27): run_extract(), available_video_ids(), clips_by_gloss(), coverage_for(), GlossCoverage, load_class_list(), load_wlasl_index(), WLASL dataset adapter — parse the canonical metadata, select a curated gloss sub (+19 more)

### Community 45 - "Community 45"
Cohesion: 0.13
Nodes (13): Environment, Model export, Normalization parity, Python rules — ML pipeline, Quality gates (must pass before PR merge), Structure, Style & types, Testing (+5 more)

### Community 46 - "Community 46"
Cohesion: 0.13
Nodes (15): class_weights(), Fraction of rows whose true label is in the model's top-``k`` predictions., Inverse-frequency class weights (normalized to mean 1) for a weighted     cross-, Train the ``arch`` model (:func:`build_model`) with early stopping on val loss;, top_k_accuracy(), train_and_eval(), test_class_weights_inverse_frequency_mean_one(), test_class_weights_unseen_class_gets_weight() (+7 more)

### Community 47 - "Community 47"
Cohesion: 0.16
Nodes (11): LETTER_HINTS, SHORT_WORDS, ADR-0012, ALPHABET, defaultCurriculumRepo, defaultWordRepo, mocks, renderView() (+3 more)

### Community 49 - "Community 49"
Cohesion: 0.14
Nodes (14): Acceptance, Conventions (unchanged from phase 1), Deliverables, Dependency / sequencing notes, Non-goals (P2M1), P2M1 — Per-finger colors in the hand-tracking overlay, P2M2 — Camera persists across views (shared stream) + one-time explainer, P2M3 — Full UI redesign (+6 more)

### Community 50 - "Community 50"
Cohesion: 0.16
Nodes (17): canonical_label(), Normalize a source gloss to the canonical vocabulary.      Lowercase, collapse i, download_clip(), _ensure_deno_on_path(), _load_yt_dlp(), main(), _prepend_path(), Download MS-ASL clips for the chosen glosses -> ``data/msasl/videos/``.  MS-ASL (+9 more)

### Community 51 - "Community 51"
Cohesion: 0.26
Nodes (9): Prediction, normalizeHandLandmarks(), subtract(), makeHand(), sampleHand(), fingerspellingModel, SignRecognitionResult, Handedness (+1 more)

### Community 53 - "Community 53"
Cohesion: 0.15
Nodes (13): Accuracy track — lifting the low-confidence signs (P4M2–P4M8), ADRs to record in this track (as each milestone lands), Cross-cutting rules (apply to every milestone in this track), P4M2 — Diagnose: confusion matrix + per-gloss diversity (measure first), P4M3 — Augmentation & loss levers (cheap, no spec change), P4M4 — Motion / velocity features (spec change — parity-critical), P4M5 — Temporal model upgrade (attention pooling; optional two-stream), P4M6 — Targeted per-gloss data fetch (the proven lever; owner-gated) (+5 more)

### Community 54 - "Community 54"
Cohesion: 0.15
Nodes (13): 1. Vision, 2. Target users, 3. Platforms, 4. Difficulty levels, 5.1 Learn mode, 5.2 Practice mode, 5. Modes, 6. Functional requirements summary (traceable) (+5 more)

### Community 57 - "Community 57"
Cohesion: 0.19
Nodes (7): LabelStabilizer, FingerspellStage(), handFromHolistic(), SignKind, SignMatch, ADR-0018, useUnifiedSignRecognition

### Community 58 - "Community 58"
Cohesion: 0.33
Nodes (10): normalize_hand_landmarks(), Normalize one hand's 21 (x, y, z) landmarks. Returns a (21, 3) array., Parity + invariant tests for the Python normalization (mirror of the TS one)., _sample_hand(), test_left_mirrors_x_relative_to_right(), test_matches_shared_golden_fixture(), test_reference_distance_becomes_one(), test_wrist_maps_to_origin() (+2 more)

### Community 59 - "Community 59"
Cohesion: 0.24
Nodes (8): extract_dataset(), _load_detector(), Real-data path: extract normalized landmark features from ASL-alphabet images., Detect, normalize and flatten landmarks for every labeled image.      ``max_per_, flatten_landmarks(), Hand-landmark normalization — mirror of ``frontend/src/recognition/normalization, Flatten landmarks to a ``[x0, y0, z0, x1, y1, z1, ...]`` feature vector., test_flatten_orders_xyz()

### Community 60 - "Community 60"
Cohesion: 0.17
Nodes (12): Backlog (required), Before every PR merge (required), Change log (required), Documentation map, Don't commit secrets, Git workflow (required), Issues, PRs and CI (required), Sign App — Project Guide (+4 more)

### Community 67 - "Community 67"
Cohesion: 0.17
Nodes (12): Current state, Decisions made during planning, Historical narrative (Phase 2 → 3), Log, Milestone checklist, Open questions to resolve (by milestone), Phase 2 checklist (see [`docs/phase2.md`](docs/phase2.md)), Phase 3 checklist (see [`docs/phase3.md`](docs/phase3.md)) (+4 more)

### Community 68 - "Community 68"
Cohesion: 0.18
Nodes (11): build_baseline(), build_model(), build_sequence_model(), build_tcn_model(), A 2-layer GRU classifier (logits output).      ``pooling`` chooses how the GRU o, A dilated 1D temporal-conv classifier (logits output), the #64 bake-off winner., Dispatch on ``arch``: ``"gru"`` (:func:`build_sequence_model`, which takes the, test_attention_pooling_handles_all_padding_row_without_nan() (+3 more)

### Community 69 - "Community 69"
Cohesion: 0.22
Nodes (10): build_metadata(), export_onnx(), quantize_weights_int8(), Export the trained dynamic-sign model to ONNX for the frontend (ADR-015).  PyTor, Export ``model`` to ``out_dir/model.onnx`` (batch axis dynamic) + metadata., Sidecar the frontend reads to validate + label the model (pure/testable).      O, Weight-only int8: store each fp32 initializer with ≥ ``min_size`` elements as, test_build_metadata_carries_skew_guard() (+2 more)

### Community 70 - "Community 70"
Cohesion: 0.29
Nodes (6): load_or_extract(), main(), Letters (static fingerspelling) baseline CV (issue #64).  Re-extracts landmarks, Train the static-sign MLP classifier (scikit-learn)., Fit a small ReLU MLP. Returns the fitted scikit-learn classifier., train_mlp()

### Community 71 - "Community 71"
Cohesion: 0.29
Nodes (7): Frontend, License and training data, ML pipeline, Quick start, Repository layout, Sign App, Status

### Community 72 - "Community 72"
Cohesion: 0.26
Nodes (8): mulberry32(), completeFirstSet(), mocks, renderView(), startFirstSet(), ADR-0008, mocks, renderView()

### Community 73 - "Community 73"
Cohesion: 0.22
Nodes (7): HolisticDetector, firstOrNull(), HolisticResultLike, NOTE: WASM + model load from CDN at runtime for now; bundling + service-worker, ResultArg, toHolisticObservation(), ADR-0018

### Community 74 - "Community 74"
Cohesion: 0.27
Nodes (7): loadSignReference(), RawFrame, ReferenceClip, toLandmarks(), toObservation(), ADR-0017, clip

### Community 75 - "Community 75"
Cohesion: 0.20
Nodes (10): Branch & merge plan (owner-requested), Decisions to record on completion, Final — docs + integration merge, P5M1 — Sentence content bank + pure domain, P5M2 — Persisted sentence progress (FR-6 "tracked"), P5M3 — The Sentences section (route + UI + e2e), Phase 5 checklist, Phase 5 — the Sentences section (+2 more)

### Community 76 - "Community 76"
Cohesion: 0.20
Nodes (10): 0. (New, do first) Make accuracy *measurable* before chasing it, 1. MS-ASL download → retrain — ✅ green-light, highest leverage, 2. Scrape the internet for ASL videos — ⚠️ reframe hard; this is the trap, 3. Apply blur / modifiers to the data — ⚠️ right idea, wrong layer, Cross-cutting, Feedback on the Phase 3 Plan, Open questions to settle before P3M2, Overall — name the tension before building (+2 more)

### Community 78 - "Community 78"
Cohesion: 0.33
Nodes (5): make_synthetic_dataset(), Datasets for the fingerspelling classifier.  The synthetic generator produces a, Generate a deterministic synthetic landmark dataset.      Each class gets a dist, test_synthetic_dataset_is_deterministic(), test_synthetic_dataset_shapes()

### Community 79 - "Community 79"
Cohesion: 0.20
Nodes (9): Browser latency method, C: quantisation (every fold model, scored on its own held-out fold), Classifier bake-off: results (issue #64), Dynamic signs (signer-disjoint, 15 runs each), Letters (static fingerspelling MLP), Reproduce, Setup, Top-10 confused pairs (+1 more)

### Community 80 - "Community 80"
Cohesion: 0.20
Nodes (10): build_masked_autoencoder(), mask_frames(), pretrain_encoder(), Corrupt a batch of ``(B, T, F)`` windows for masked-pose pretraining (P4M8):, A denoising autoencoder that shares the classifier's GRU encoder (identical, Self-supervised masked-pose pretraining on the unlabeled pool (P4M8, ADR-026)., test_mask_frames_is_deterministic(), test_mask_frames_only_masks_real_frames() (+2 more)

### Community 81 - "Community 81"
Cohesion: 0.20
Nodes (10): 1. Goal, 2.1 Learning route (the syllabus), 2.2 Teach → recall loop, 2.3 Two paths, both open at all times, 2. The learning system, 3. Presentation, 4. Out of scope (this phase), 5. Suggested build order (+2 more)

### Community 82 - "Community 82"
Cohesion: 0.26
Nodes (4): ProfileRecord, WordBankRepo, newWordProgress(), UserProfile

### Community 83 - "Community 83"
Cohesion: 0.22
Nodes (8): After the first deploy — verify, Alternatives (equivalent, if ever needed), Hosting — Cloudflare Pages, How to deploy (M7) — click-by-click, What is Cloudflare?, What is Cloudflare Pages?, What we are NOT using, Why it fits this project

### Community 92 - "Workflow rules — issues, git, PRs, CI, quality gates"
Cohesion: 0.22
Nodes (9): Components, Domain logic must stay pure, Frontend rules — React + TypeScript, Language & types, Quality gates (must pass before PR merge), Recognition layer, State & data, Styling & a11y (+1 more)

### Community 93 - "mediapipeDetector.ts"
Cohesion: 0.18
Nodes (11): CameraView(), createMediaPipeHandDetector(), NOTE: WASM + model are loaded from CDN at runtime for now. Bundling and, toHandedness(), toObservations(), ADR-0018, recognizeSign(), LandmarkDetector (+3 more)

### Community 94 - "package_name"
Cohesion: 0.25
Nodes (5): package_name(), Sign App ML pipeline (build-time only).  Trains the ASL recognition model from h, Return the package name. Placeholder until M2 adds the real pipeline., Smoke tests proving the package imports and the toolchain runs (M0)., test_package_name()

### Community 95 - "P4M1 — Sign search tab"
Cohesion: 0.22
Nodes (9): CI, Commits, Invariants, Quality gates (every PR, before merge), Repository, Secrets, credentials & external accounts — STOP and ask, The loop, Workflow rules — issues, git, PRs, CI, quality gates (+1 more)

### Community 96 - "Python rules — ML pipeline"
Cohesion: 0.19
Nodes (10): isDynamicGloss(), SHIPPED_GLOSSES, defaultRepo, Phase, PracticeMode(), mocks, ADR-0008, SignReferencePlayer() (+2 more)

### Community 97 - "Backlog"
Cohesion: 0.33
Nodes (5): Each sync, One-time setup, Public mirror: how it works and how to sync it, When something changes, Why a rewritten mirror

### Community 98 - "pull_request_template.md"
Cohesion: 0.25
Nodes (8): Acceptance criteria, Architecture — reuse, don't rebuild, Out of scope / deferred (future milestones), P4M1 — Sign search tab, Phase 4 — Discovery & Accuracy, Scope decisions (owner-confirmed), Tests (part of the deliverable), Work items

### Community 99 - "Sign App"
Cohesion: 0.29
Nodes (6): Backlog, Bugs / known gaps, Learner app / content, Platform / store, Recognition / model track, Tooling

### Community 100 - ".prettierrc.json"
Cohesion: 0.40
Nodes (4): printWidth, semi, singleQuote, trailingComma

### Community 101 - "Reaching 100 published signs"
Cohesion: 0.50
Nodes (4): classify_low_signs(), Classify each below-gate gloss by its **likely cause**, to route it to the right, test_classify_low_signs_causes(), test_classify_low_signs_poorly_tracked_and_mixed()

### Community 102 - "feature.md"
Cohesion: 0.33
Nodes (5): Before merge, Follow-ups filed, How it was tested, What changed, Why

### Community 103 - "sign-ml"
Cohesion: 0.33
Nodes (6): Assign whole **signers** to ``k`` folds; return a per-fold boolean test mask, signer_folds(), test_signer_folds_balances_by_sample_count(), test_signer_folds_deterministic_with_seed(), test_signer_folds_handles_unknown_signers(), test_signer_folds_partition_and_no_leakage()

### Community 104 - "gradlew"
Cohesion: 0.83
Nodes (3): gradlew script, die(), warn()

### Community 105 - "now.json"
Cohesion: 0.50
Nodes (3): frames, gloss, videoId

### Community 107 - "React + TypeScript + Vite"
Cohesion: 0.40
Nodes (4): Reaching 100 published signs, Step 1 — Download the clips (owner), Step 2 — Extract + retrain + gate (automated, after the download), The 36 download glosses

### Community 108 - "bug.md"
Cohesion: 0.40
Nodes (5): Current state at a glance, Document map, Sign App — How It Works, The 60-second version, Where this docs set fits

### Community 113 - "load_class_list"
Cohesion: 0.40
Nodes (4): Acceptance criteria, Context, Notes, Scope

### Community 114 - "2026-11-03"
Cohesion: 0.40
Nodes (5): 7. Accuracy, honestly, Per-sign acceptance, not open-set classification, The numbers, Vocabulary expansion is accuracy-gated, Why "the user said it but the model didn't see it" is okay

### Community 115 - "2026-11-05"
Cohesion: 0.33
Nodes (5): 2026-11-05, Classifier bake-off: baseline vs TCN vs hand-shape features vs quantised ONNX (#64), Prepare a redacted public mirror (licence + publish script) (#72), Published the 4 signs the TCN lifted over the gate (#67), Ship the TCN as the dynamic-sign model (#66)

### Community 117 - "run_all.sh"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 128 - "Any"
Cohesion: 0.50
Nodes (3): Acceptance criteria, Evidence, Problem

### Community 136 - "FloatArray"
Cohesion: 0.50
Nodes (4): 9. The training pipeline (Python side), Dynamic (words), Quality gates, Static (letters)

## Knowledge Gaps
- **614 isolated node(s):** `graphify-guard.sh script`, `PATH`, `semi`, `singleQuote`, `trailingComma` (+609 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **73 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `augment_sequences()` connect `Community 14` to `Community 2`, `Community 28`, `Community 46`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `cross_validate_frozen()` connect `Community 2` to `Community 14`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `cross_validate()` connect `Community 28` to `Community 34`, `Community 68`, `sign-ml`, `Community 46`, `Community 14`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `graphify-guard.sh script`, `PATH`, `semi` to the rest of the system?**
  _614 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.13675213675213677 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.058673469387755105 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.14333333333333334 - nodes in this community are weakly interconnected._