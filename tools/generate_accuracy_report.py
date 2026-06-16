"""Generate ``docs/sign-language-accuracy.xlsx`` — the per-word recognition-accuracy
report for the dynamic ASL signs.

It lists **every word the model was trained on** (the 81-gloss cache), sorted
**alphabetically**, with its **honest signer-disjoint cross-validation top-1 accuracy**
(the ship gate, ADR-019), marks which are **deployed** vs **attempted but below the
0.50 gate**, and shows a dedicated **"Band" column whose background colour** encodes the
accuracy:

* **green**  — accuracy >= 70 %
* **yellow** — 50 % <= accuracy < 70 %
* **red**    — accuracy < 50 %

The Band colour is a real Excel **conditional-formatting rule that reads the accuracy
column**, so a **manually added** row colours its Band cell automatically (see the
"How to update" sheet inside the workbook).

Data source: ``ml/models/combined/cv_metrics.json`` (written by
``dynamic_pipeline crossval``); deployed set: ``frontend/src/content/dynamicVocab.ts``.

Regenerate after a retrain (from the repo root)::

    cd ml && uv run --with openpyxl python ../tools/generate_accuracy_report.py

``uv run --with openpyxl`` pulls openpyxl into an ephemeral overlay, so the project's
pinned dependencies are untouched. This script lives outside ``ml/`` and ``frontend/``
so neither lint lane gates it.
"""

from __future__ import annotations

import datetime as dt
import json
import re
from pathlib import Path

from openpyxl import Workbook
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet

REPO = Path(__file__).resolve().parent.parent
CV_METRICS = REPO / "ml" / "models" / "combined" / "cv_metrics.json"
SHIPPED_TS = REPO / "frontend" / "src" / "content" / "dynamicVocab.ts"
OUT = REPO / "docs" / "sign-language-accuracy.xlsx"

# Excel's standard "good/neutral/bad" palette. NOTE: for conditional-formatting
# (differential) fills Excel renders the *bgColor* of a solid pattern, not fgColor —
# so set start_color AND end_color to the same value or the highlight won't show.
GREEN = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
YELLOW = PatternFill(start_color="FFEB9C", end_color="FFEB9C", fill_type="solid")
RED = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")
HEADER_FILL = PatternFill("solid", fgColor="305496")
HEADER_FONT = Font(bold=True, color="FFFFFF")

# Column layout (1-based). The Band column carries the colour; accuracy stays plain.
COL_WORD, COL_BAND, COL_ACC, COL_STATUS, COL_N, COL_SIGNERS, COL_NOTES = range(1, 8)
HEADERS = {
    COL_WORD: "Word",
    COL_BAND: "Band",
    COL_ACC: "Honest top-1 accuracy (%)",
    COL_STATUS: "Status",
    COL_N: "Samples (n)",
    COL_SIGNERS: "Distinct signers",
    COL_NOTES: "Notes",
}
DATA_START_ROW = 6  # title block occupies rows 1-4, header row 5
CF_LAST_ROW = 1000  # conditional formatting covers far past the data for new rows


def read_shipped() -> list[str]:
    """The deployed glosses, parsed from the frontend source of truth.

    Matches ``SHIPPED_GLOSSES ... = [ ... ]`` (``[^=]*=`` skips the ``string[]``
    type annotation, whose brackets precede the array literal).
    """
    text = SHIPPED_TS.read_text(encoding="utf-8")
    match = re.search(r"SHIPPED_GLOSSES[^=]*=\s*\[(.*?)\]", text, re.S)
    if match is None:
        raise ValueError("could not locate SHIPPED_GLOSSES array in dynamicVocab.ts")
    return re.findall(r"'([^']+)'", match.group(1))


def band_label(acc: float) -> str:
    """Plain-text tier so the colour band is meaningful when printed / colour-blind."""
    if acc >= 70:
        return "Good"
    if acc >= 50:
        return "Okay"
    return "Bad"


def build_rows() -> tuple[list[tuple[str, float, str, int, int, str]], dict[str, float]]:
    metrics = json.loads(CV_METRICS.read_text(encoding="utf-8"))
    per_gloss: dict[str, dict[str, float]] = metrics["per_gloss"]
    shipped = set(read_shipped())

    rows: list[tuple[str, float, str, int, int, str]] = []
    for gloss, m in per_gloss.items():
        top1 = float(m["top1"])
        acc = round(top1 * 100, 1)
        deployed = gloss in shipped
        if deployed and top1 < 0.50:
            status, note = "Deployed", "Shipped incumbent kept (no-demote-on-noise)"
        elif deployed:
            status, note = "Deployed", ""
        else:
            status, note = "Attempted — below gate", "Honest top-1 < 0.50; not shipped"
        rows.append((gloss, acc, status, int(m["n"]), int(m["signers"]), note))

    rows.sort(key=lambda r: r[0].lower())  # alphabetical by word
    summary = {
        "aggregate": float(metrics["cv_top1"]) * 100,
        "total": float(len(per_gloss)),
        "deployed": float(len(shipped)),
    }
    return rows, summary


def write_data_sheet(
    ws: Worksheet,
    rows: list[tuple[str, float, str, int, int, str]],
    summary: dict[str, float],
) -> None:
    ws.title = "Sign accuracy"
    today = dt.date.today().isoformat()
    ws["A1"] = "ASL Sign Recognition — Honest Per-Word Accuracy"
    ws["A1"].font = Font(bold=True, size=14)
    ws["A2"] = (
        "Metric: signer-disjoint cross-validation top-1 (ADR-019). "
        "Model: BiGRU + attention + label smoothing 0.15 (P4M10)."
    )
    ws["A3"] = (
        f"Aggregate top-1: {summary['aggregate']:.1f}%  ·  "
        f"Deployed: {int(summary['deployed'])} of {int(summary['total'])} trained words  ·  "
        f"Generated: {today}"
    )
    ws["A4"] = "Band colour: green >= 70%  ·  yellow 50-70%  ·  red < 50%  (sorted A→Z)"
    ws["A4"].font = Font(italic=True, color="595959")

    header_row = DATA_START_ROW - 1
    for col, name in HEADERS.items():
        cell = ws.cell(row=header_row, column=col, value=name)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    for i, (word, acc, status, n, signers, note) in enumerate(rows):
        r = DATA_START_ROW + i
        ws.cell(row=r, column=COL_WORD, value=word)
        ws.cell(row=r, column=COL_BAND, value=band_label(acc))
        ws.cell(row=r, column=COL_ACC, value=acc)
        ws.cell(row=r, column=COL_STATUS, value=status)
        ws.cell(row=r, column=COL_N, value=n)
        ws.cell(row=r, column=COL_SIGNERS, value=signers)
        ws.cell(row=r, column=COL_NOTES, value=note)

    # Colour the BAND column from the accuracy column via formula-based conditional
    # formatting, so a newly-added row colours its Band cell automatically (the row
    # reference $<acc>6 is relative — it follows each row down the range).
    band_col = get_column_letter(COL_BAND)
    acc_col = get_column_letter(COL_ACC)
    band_rng = f"{band_col}{DATA_START_ROW}:{band_col}{CF_LAST_ROW}"
    first = DATA_START_ROW
    ws.conditional_formatting.add(
        band_rng,
        FormulaRule(formula=[f"${acc_col}{first}>=70"], stopIfTrue=True, fill=GREEN),
    )
    ws.conditional_formatting.add(
        band_rng,
        FormulaRule(formula=[f"${acc_col}{first}>=50"], stopIfTrue=True, fill=YELLOW),
    )
    ws.conditional_formatting.add(
        band_rng,
        FormulaRule(
            formula=[f"AND(${acc_col}{first}<>\"\",${acc_col}{first}<50)"],
            stopIfTrue=True,
            fill=RED,
        ),
    )

    widths = {"A": 16, "B": 18, "C": 24, "D": 26, "E": 13, "F": 16, "G": 42}
    for col, w in widths.items():
        ws.column_dimensions[col].width = w
    ws.freeze_panes = f"A{DATA_START_ROW}"
    ws.auto_filter.ref = f"A{header_row}:G{DATA_START_ROW + len(rows) - 1}"


def write_instructions_sheet(ws: Worksheet) -> None:
    ws["A1"] = "How to update this report"
    ws["A1"].font = Font(bold=True, size=14)
    lines = [
        "",
        "What this is",
        "  Every dynamic ASL sign the model was trained on, sorted A→Z, with its HONEST",
        "  accuracy (signer-disjoint cross-validation top-1 — the ship gate, ADR-019).",
        "  'Deployed' words are live in the app; 'Attempted — below gate' words were",
        "  trained but did not clear the 0.50 bar, so they are not offered.",
        "",
        "The 'Band' column (the colour + Good/Okay/Bad label)",
        "  Its background colour and label encode the accuracy in the same row:",
        "    green   Good   accuracy >= 70%",
        "    yellow  Okay   50% <= accuracy < 70%",
        "    red     Bad    accuracy < 50%",
        "  The colour is a conditional-formatting rule that READS the accuracy column,",
        "  so it stays correct automatically.",
        "",
        "Add a new word MANUALLY",
        "  1. Go to the 'Sign accuracy' sheet.",
        "  2. Add a row directly under the last word: Word, Band, accuracy %, Status,",
        "     Samples, Signers, Notes.",
        "  3. Just type the accuracy in the 'Honest top-1 accuracy (%)' column — the Band",
        "     cell colours itself automatically (rules cover rows 6-1000). Optionally type",
        "     a label in Band (Good / Okay / Bad) to match the others.",
        "  (Re-sort A→Z by the Word column afterwards if you want to keep the order.)",
        "",
        "Regenerate from the model after a retrain (overwrites this file)",
        "  From the repo root:",
        "      cd ml && uv run --with openpyxl python ../tools/generate_accuracy_report.py",
        "  It reads the latest honest cross-validation results from",
        "  ml/models/combined/cv_metrics.json and the deployed list from",
        "  frontend/src/content/dynamicVocab.ts, then rewrites",
        "  docs/sign-language-accuracy.xlsx.",
        "",
        "Where the numbers come from",
        "  Run the honest gate to refresh cv_metrics.json (matches the shipped model):",
        "      cd ml && uv run python -m sign_ml.dynamic_pipeline crossval \\",
        "          --cache models/combined --aug --pooling attention --bidirectional \\",
        "          --label-smoothing 0.15",
        "  See .claude/docs/recognition.md section 6.12 for the methodology.",
    ]
    for i, line in enumerate(lines, start=2):
        cell = ws.cell(row=i, column=1, value=line)
        if line.strip() and not line.startswith("  "):
            cell.font = Font(bold=True)
    ws.column_dimensions["A"].width = 92


def main() -> None:
    rows, summary = build_rows()
    wb = Workbook()
    write_data_sheet(wb.active, rows, summary)
    write_instructions_sheet(wb.create_sheet("How to update"))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    wb.save(OUT)
    deployed = sum(1 for r in rows if r[2] == "Deployed")
    print(f"Wrote {OUT} — {len(rows)} words ({deployed} deployed), aggregate {summary['aggregate']:.1f}%")


if __name__ == "__main__":
    main()
