#!/usr/bin/env bash
# Run the bake-off training in memory-safe batches (issue #64): one seed at a time,
# its three candidates in parallel (1 thread each), then the letter CV. Skips any
# (candidate, seed) that already has a summary.json, so it can be re-run to resume.
#
#   BAKEOFF_DATA_ROOT=<checkout with ml/models + ml/data> \
#   ML_PROJECT=<that checkout>/ml  bash ml/experiments/bakeoff/run_all.sh
set -u
cd "$(dirname "$0")"
: "${BAKEOFF_DATA_ROOT:?set to the checkout that holds ml/models and ml/data}"
ML_PROJECT="${ML_PROJECT:-$BAKEOFF_DATA_ROOT/ml}"
export BAKEOFF_DATA_ROOT
OUT=../runs
mkdir -p "$OUT"
for s in 42 43 44; do
  for c in baseline tcn handshape; do
    if [ -f "$OUT/$c/seed$s/summary.json" ]; then echo "skip $c seed$s"; continue; fi
    uv run --project "$ML_PROJECT" --extra train python run_cv.py --candidate "$c" \
      --seed "$s" --threads 1 > "$OUT/${c}_seed${s}.out" 2>&1 &
  done
  wait
  echo "seed $s batch done: $(date)"
done
uv run --project "$ML_PROJECT" --extra images python letters.py > "$OUT/letters.out" 2>&1
echo "letters done: $(date)"
