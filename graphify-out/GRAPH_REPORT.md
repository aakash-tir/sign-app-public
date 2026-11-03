# Graph Report - .  (2026-11-03)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1175 nodes · 2577 edges · 92 communities (67 shown, 25 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 144 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `03aa5384`
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
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
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
- Community 91

## God Nodes (most connected - your core abstractions)
1. `WordBankRepo` - 40 edges
2. `UseDynamicSignRecognition` - 30 edges
3. `SignAppDB` - 28 edges
4. `CanonicalSample` - 24 edges
5. `cross_validate()` - 22 edges
6. `UseUnifiedSignRecognition` - 21 edges
7. `compilerOptions` - 20 edges
8. `compilerOptions` - 18 edges
9. `train_and_eval()` - 18 edges
10. `normalize_frame()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `test_cross_validate_motion_runs()` --calls--> `cross_validate()`  [INFERRED]
  ml/tests/test_dynamic_model.py → ml/src/sign_ml/dynamic_model.py
- `unit()` --indirect_call--> `curriculumSetOf()`  [INFERRED]
  frontend/src/content/curriculum.ts → frontend/src/domain/curriculum.ts
- `ProfileRecord` --inherits--> `UserProfile`  [EXTRACTED]
  frontend/src/data/db.ts → frontend/src/domain/types.ts
- `DynamicSignStageProps` --references--> `UseDynamicSignRecognition`  [EXTRACTED]
  frontend/src/recognition/DynamicSignStage.tsx → frontend/src/recognition/useDynamicSignRecognition.ts
- `test_synthetic_dataset_is_deterministic()` --calls--> `make_synthetic_dataset()`  [INFERRED]
  ml/tests/test_pipeline.py → ml/src/sign_ml/data.py

## Import Cycles
- None detected.

## Communities (92 total, 25 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (73): Frame, int64, extract_clip(), extract_dataset(), _landmarks_or_none(), _load_holistic_detector(), normalize_clip(), Any (+65 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (52): drawHand(), drawHolistic(), drawPose(), POSE_CONNECTIONS, FINGER_PALETTE, inFrame(), makeObservation(), drawHands() (+44 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (58): make_synthetic_dataset(), FloatArray, IntArray, Datasets for the fingerspelling classifier.  The synthetic generator produces a, Generate a deterministic synthetic landmark dataset.      Each class gets a dist, evaluate(), Any, FloatArray (+50 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (39): add_motion_features(), normalize_frame(), normalize_pose(), ArrayLike, FloatArray, Append per-frame **velocity** (first difference of the spatial coords) to a, Batched :func:`with_motion` over ``(N, T, F)`` windows → ``(N, T, 2F - 2)``., Shoulder-center + shoulder-width-scale the upper-body pose subset.      Returns (+31 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (23): ADR-0005, ProfileRecord, SignAppDB, ADR-0028, ADR-0029, SentenceRepo, ADR-0028, mulberry32() (+15 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (25): LETTER_BATCHES, SHORT_WORDS, spellableWords(), ADR-0012, CurriculumRepo, ADR-0029, sentencesEnabled(), CurriculumSetProgress (+17 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (32): _build_combined_samples(), Deterministic merged + signer-disjoint-split sample list for the combined     da, assign_signer_disjoint_splits(), CanonicalSample, coverage_by_label(), DatasetAdapter, main(), merge() (+24 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (34): cross_validate(), k-fold CV → a trustworthy aggregate + per-gloss top-1, since the native WLASL, _clip_cache_path(), _clip_skip_path(), _extract_worker(), _load_encoder_state(), main(), Any (+26 more)

### Community 8 - "Community 8"
Cohesion: 0.13
Nodes (23): App(), db, defaultRepo, emit(), getDevMode(), listeners, loadDevMode(), setDevMode() (+15 more)

### Community 9 - "Community 9"
Cohesion: 0.16
Nodes (21): ADR-0015, ADR-0022, accepts(), acceptThresholdFor(), assertMetadataCompatible(), averageProbs(), DynamicClassifier, DynamicModelMetadata (+13 more)

### Community 10 - "Community 10"
Cohesion: 0.12
Nodes (17): ADR-0010, ADR-0009, applyOutcome(), newWordProgress(), ADR-0008, nextSentencesUnlocked(), ADR-0009, AttemptOutcome (+9 more)

### Community 11 - "Community 11"
Cohesion: 0.15
Nodes (24): CurriculumSet, avoidLast(), confirmTaught(), dueNewSigns(), nextRecallPrompt(), RecallPhase, recallProgress(), RecallPrompt (+16 more)

### Community 12 - "Community 12"
Cohesion: 0.12
Nodes (20): ADR-0007, ADR-0019, PRIORITY_WORDS, EXPECTED_PLACEHOLDERS, recognized, route, routeWords, ADR-0029 (+12 more)

### Community 13 - "Community 13"
Cohesion: 0.08
Nodes (25): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+17 more)

### Community 14 - "Community 14"
Cohesion: 0.13
Nodes (21): _clip_from_entry(), load_msasl_index(), MsaslAdapter, MsaslClip, Path, MS-ASL dataset adapter (Phase 3 / P3M2).  MS-ASL (Microsoft, ~1000 signs / ~25k, Flatten the ``MSASL_{split}.json`` files present under ``data_dir`` into a     l, MS-ASL as a :class:`~sign_ml.ingest.DatasetAdapter`: emits the clips whose     * (+13 more)

### Community 15 - "Community 15"
Cohesion: 0.11
Nodes (19): SIGN_SENTENCES, ADR-0009, ADR-0012, ADR-0028, SignSentence, CoursePathSwitch(), defaultCurriculumRepo, defaultSentenceRepo (+11 more)

### Community 16 - "Community 16"
Cohesion: 0.08
Nodes (23): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+15 more)

### Community 17 - "Community 17"
Cohesion: 0.12
Nodes (23): augment_sequences(), drop_landmarks(), Zero individual landmarks (their whole ``x,y,z`` triplet) per frame with     pro, Per-sample speed warp: resample frames on a rate-warped timeline **anchored, Augment a batch of ``(B, T, F)`` windows — the main lever for the tiny     curat, Assign whole **signers** to ``k`` folds; return a per-fold boolean test mask, signer_folds(), time_warp() (+15 more)

### Community 18 - "Community 18"
Cohesion: 0.11
Nodes (22): confusion_matrix(), distinct_signers_per_class(), fit_per_sign_thresholds(), fit_temperature(), mean_hand_presence_per_class(), IntArray, Dynamic-sign sequence model: a small GRU over windowed landmark features.  PyTor, Assign each sample to one of ``k`` folds, balanced per class. Returns a     per- (+14 more)

### Community 19 - "Community 19"
Cohesion: 0.15
Nodes (14): canFingerspell(), fingerspellLetters(), ALPHABET, SignMatch, DynamicSignView(), mocks, ALPHABET, optionId() (+6 more)

### Community 20 - "Community 20"
Cohesion: 0.10
Nodes (21): @capacitor/cli, eslint, eslint-plugin-react-hooks, fake-indexeddb, devDependencies, @capacitor/cli, eslint, eslint-plugin-react-hooks (+13 more)

### Community 21 - "Community 21"
Cohesion: 0.19
Nodes (18): CurriculumUnit, flattenRoute(), isPlaceholderOnlySet(), learnedPool(), priorityWords(), routeAccess(), routeConstructibility(), sentencesBuildableFrom() (+10 more)

### Community 22 - "Community 22"
Cohesion: 0.19
Nodes (16): Activation, classify(), dense(), MlpLayer, MlpModel, Prediction, relu(), runModel() (+8 more)

### Community 23 - "Community 23"
Cohesion: 0.16
Nodes (19): canonical_label(), Normalize a source gloss to the canonical vocabulary.      Lowercase, collapse i, download_clip(), _ensure_deno_on_path(), _load_yt_dlp(), main(), _prepend_path(), Any (+11 more)

### Community 24 - "Community 24"
Cohesion: 0.18
Nodes (14): assign_columns(), endpoint(), esc(), group_chain(), layout(), main(), Node, (cx, cy, left, right, top, bottom, column) for a node OR group id. (+6 more)

### Community 25 - "Community 25"
Cohesion: 0.15
Nodes (17): BoolArray, _carve(), NDArray, str_, Boolean train/val/test masks from WLASL split labels, with fallbacks for     the, Move a deterministic ``frac`` of the True positions of ``mask`` into a new     m, Train the GRU with early stopping on val loss; report top-1/top-5 on test., resolve_splits() (+9 more)

### Community 26 - "Community 26"
Cohesion: 0.12
Nodes (17): @capacitor/android, @capacitor/core, dexie, dependencies, @capacitor/android, @capacitor/core, dexie, @mediapipe/tasks-vision (+9 more)

### Community 27 - "Community 27"
Cohesion: 0.19
Nodes (12): CameraContext, CameraContextValue, CameraStatus, TestConsumer(), ADR-0018, useCameraContext(), attachStream(), fakeStream (+4 more)

### Community 28 - "Community 28"
Cohesion: 0.31
Nodes (5): WordBankRepo, UserProfile, CameraProvider(), defaultRepo, ADR-0018

### Community 29 - "Community 29"
Cohesion: 0.21
Nodes (9): Rng, PracticeSession, rememberRecent(), selectNextWord(), bankOf(), word(), Bucket, WordsPathViewProps (+1 more)

### Community 30 - "Community 30"
Cohesion: 0.18
Nodes (11): mocks, normalizeFrame(), normalizePose(), zeros(), createMediaPipeHolisticDetector(), getOverlayColorMode(), handFromHolistic(), SignKind (+3 more)

### Community 31 - "Community 31"
Cohesion: 0.31
Nodes (11): SIGN_SYNONYMS, autocomplete(), editDistance(), fuzzySuggestions(), matchSign(), normalizeQuery(), resolve(), stems() (+3 more)

### Community 32 - "Community 32"
Cohesion: 0.21
Nodes (6): CameraView(), LabelStabilizer, createMediaPipeHandDetector(), SignPrediction, ADR-0018, UseSignRecognition

### Community 33 - "Community 33"
Cohesion: 0.16
Nodes (14): build_masked_autoencoder(), build_sequence_model(), classify_low_signs(), pretrain_encoder(), Any, Classify each below-gate gloss by its **likely cause**, to route it to the right, A 2-layer GRU classifier (logits output).      ``pooling`` chooses how the GRU o, A denoising autoencoder that shares the classifier's GRU encoder (identical (+6 more)

### Community 34 - "Community 34"
Cohesion: 0.22
Nodes (10): eligibleSentences(), LEVEL_LENGTH_BANDS, pickSentence(), sentenceOf(), allSigns, bank, ADR-0009, ADR-0012 (+2 more)

### Community 35 - "Community 35"
Cohesion: 0.20
Nodes (11): build_metadata(), export_onnx(), Any, Path, Export the trained dynamic-sign model to ONNX for the frontend (ADR-015).  PyTor, Sidecar the frontend reads to validate + label the model (pure/testable).      O, Export ``model`` to ``out_dir/model.onnx`` (batch axis dynamic) + metadata., Path (+3 more)

### Community 36 - "Community 36"
Cohesion: 0.18
Nodes (11): scripts, build, dev, format, format:write, lint, preview, test (+3 more)

### Community 37 - "Community 37"
Cohesion: 0.18
Nodes (11): class_weights(), FloatArray, Rotate every landmark's ``(x, y)`` by a small **per-sample** angle (``z`` and, Row-wise numerically-stable softmax (no torch)., Inverse-frequency class weights (normalized to mean 1) for a weighted     cross-, rotate_xy(), _softmax_np(), test_class_weights_inverse_frequency_mean_one() (+3 more)

### Community 38 - "Community 38"
Cohesion: 0.29
Nodes (10): band_label(), build_rows(), main(), Generate ``docs/sign-language-accuracy.xlsx`` — the per-word recognition-accurac, The deployed glosses, parsed from the frontend source of truth.      Matches ``S, Plain-text tier so the colour band is meaningful when printed / colour-blind., read_shipped(), write_data_sheet() (+2 more)

### Community 39 - "Community 39"
Cohesion: 0.25
Nodes (6): defaultRepo, Phase, PracticeMode(), mocks, ADR-0008, fingerspellingModel

### Community 40 - "Community 40"
Cohesion: 0.31
Nodes (8): all_pool_glosses(), Every gloss available across both raw indices — the entire on-disk pool for, Path, Tests for the synthetic training pipeline and the export schema., test_clip_cache_path_namespaces_by_source_and_sanitizes(), test_pipeline_trains_and_exports(), test_resolve_vocab_pretrain_unions_all_on_disk_glosses(), test_resolve_vocab_static_returns_curated_tuple()

### Community 41 - "Community 41"
Cohesion: 0.25
Nodes (5): package_name(), Sign App ML pipeline (build-time only).  Trains the ASL recognition model from h, Return the package name. Placeholder until M2 adds the real pipeline., Smoke tests proving the package imports and the toolchain runs (M0)., test_package_name()

### Community 43 - "Community 43"
Cohesion: 0.33
Nodes (5): mirror_frames(), Dynamic-sign frame normalization — mirror of ``frontend/src/recognition/dynamicN, Horizontally mirror normalized **161-d** frames — parity-correct, **train-only**, test_mirror_frame_equals_normalizing_a_flipped_capture(), test_mirror_frames_is_an_involution()

### Community 44 - "Community 44"
Cohesion: 0.60
Nodes (3): ExampleInstrumentedTest, Test, RunWith

### Community 45 - "Community 45"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 46 - "Community 46"
Cohesion: 0.40
Nodes (4): printWidth, semi, singleQuote, trailingComma

### Community 47 - "Community 47"
Cohesion: 0.40
Nodes (5): mask_frames(), Corrupt a batch of ``(B, T, F)`` windows for masked-pose pretraining (P4M8):, test_mask_frames_is_deterministic(), test_mask_frames_only_masks_real_frames(), test_mask_frames_zero_prob_masks_nothing()

### Community 48 - "Community 48"
Cohesion: 0.40
Nodes (5): Fraction of rows whose true label is in the model's top-``k`` predictions., top_k_accuracy(), test_top_k_accuracy_basic(), test_top_k_accuracy_empty(), test_top_k_clamps_k_above_classes()

### Community 50 - "Community 50"
Cohesion: 0.83
Nodes (3): gradlew script, die(), warn()

### Community 51 - "Community 51"
Cohesion: 0.50
Nodes (3): frames, gloss, videoId

## Knowledge Gaps
- **242 isolated node(s):** `graphify-guard.sh script`, `PATH`, `semi`, `singleQuote`, `trailingComma` (+237 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cross_validate()` connect `Community 7` to `Community 33`, `Community 3`, `Community 37`, `Community 17`, `Community 18`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `WordBankRepo` connect `Community 28` to `Community 4`, `Community 5`, `Community 39`, `Community 8`, `Community 10`, `Community 15`, `Community 29`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `train_and_eval()` connect `Community 25` to `Community 33`, `Community 3`, `Community 37`, `Community 7`, `Community 48`, `Community 17`, `Community 18`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `CanonicalSample` (e.g. with `WlaslAdapter` and `MsaslAdapter`) actually correct?**
  _`CanonicalSample` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `graphify-guard.sh script`, `PATH`, `semi` to the rest of the system?**
  _242 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05063291139240506 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05527805527805528 - nodes in this community are weakly interconnected._