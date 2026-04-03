from __future__ import annotations

import json
from pathlib import Path
from typing import Any


SAMPLE_TASKS = {
    "easy-color-fill.json": {
        "train": [
            {"input": [[0, 0], [0, 0]], "output": [[2, 2], [2, 2]]},
            {"input": [[0, 0, 0], [0, 0, 0]], "output": [[2, 2, 2], [2, 2, 2]]},
        ],
        "test": [
            {"input": [[0, 0], [0, 0], [0, 0]], "output": [[2, 2], [2, 2], [2, 2]]}
        ],
    },
    "easy-border-map.json": {
        "train": [
            {
                "input": [[1, 1, 1], [1, 0, 1], [1, 1, 1]],
                "output": [[3, 3, 3], [3, 0, 3], [3, 3, 3]],
            },
            {
                "input": [[1, 1, 1, 1], [1, 0, 0, 1], [1, 1, 1, 1]],
                "output": [[3, 3, 3, 3], [3, 0, 0, 3], [3, 3, 3, 3]],
            },
        ],
        "test": [
            {
                "input": [[1, 1, 1], [1, 0, 0], [1, 1, 1]],
                "output": [[3, 3, 3], [3, 0, 0], [3, 3, 3]],
            }
        ],
    },
    "medium-horizontal-flip.json": {
        "train": [
            {
                "input": [[1, 2, 0], [3, 4, 0]],
                "output": [[0, 2, 1], [0, 4, 3]],
            },
            {
                "input": [[5, 0, 6], [7, 0, 8]],
                "output": [[6, 0, 5], [8, 0, 7]],
            },
        ],
        "test": [
            {
                "input": [[9, 1, 2, 0], [4, 5, 6, 0]],
                "output": [[0, 2, 1, 9], [0, 6, 5, 4]],
            }
        ],
    },
    "medium-color-swap.json": {
        "train": [
            {
                "input": [[1, 2, 1], [2, 1, 2]],
                "output": [[2, 1, 2], [1, 2, 1]],
            },
            {
                "input": [[3, 4, 3], [0, 3, 4]],
                "output": [[4, 3, 4], [0, 4, 3]],
            },
        ],
        "test": [
            {
                "input": [[5, 6, 0], [6, 5, 5]],
                "output": [[6, 5, 0], [5, 6, 6]],
            }
        ],
    },
    "hard-frame-extract.json": {
        "train": [
            {
                "input": [[0, 0, 0, 0], [0, 7, 8, 0], [0, 9, 1, 0], [0, 0, 0, 0]],
                "output": [[7, 8], [9, 1]],
            },
            {
                "input": [[5, 5, 5, 5, 5], [5, 2, 3, 4, 5], [5, 6, 7, 8, 5], [5, 5, 5, 5, 5]],
                "output": [[2, 3, 4], [6, 7, 8]],
            },
        ],
        "test": [
            {
                "input": [[4, 4, 4], [4, 3, 4], [4, 4, 4]],
                "output": [[3]],
            }
        ],
    },
}


def _format_grid(grid: list[list[Any]]) -> str:
    return "\n".join(" ".join(str(cell) for cell in row) for row in grid)


def _extract_examples(data: dict[str, Any], key: str) -> list[dict[str, Any]]:
    examples = []
    for item in data.get(key, []) or []:
        if not isinstance(item, dict):
            continue
        examples.append(
            {
                "input": item.get("input", []),
                "output": item.get("output", []),
            }
        )
    return examples


def get_reasoning_tasks_dir(project_root: str | Path) -> Path:
    root = Path(project_root)
    return root / "reference_data" / "reasoning_tasks"


def ensure_reasoning_sample_tasks(project_root: str | Path) -> Path:
    tasks_dir = get_reasoning_tasks_dir(project_root)
    tasks_dir.mkdir(parents=True, exist_ok=True)
    for filename, payload in SAMPLE_TASKS.items():
        target = tasks_dir / filename
        if not target.exists():
            target.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return tasks_dir


def list_reasoning_tasks(project_root: str | Path) -> list[dict[str, str]]:
    tasks_dir = ensure_reasoning_sample_tasks(project_root)
    tasks: list[dict[str, str]] = []
    for path in sorted(tasks_dir.glob("*.json")):
        tasks.append({"label": path.stem.replace("-", " ").title(), "path": str(path)})
    return tasks


def load_reasoning_task(task_path: str | Path) -> dict[str, Any]:
    path = Path(task_path)
    if not path.exists():
        return {"ok": False, "message": "Task path does not exist"}

    text = path.read_text(encoding="utf-8", errors="ignore")
    suffix = path.suffix.lower()
    if suffix == ".json":
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            return {"ok": False, "message": f"Invalid JSON: {exc}"}

        train = _extract_examples(data, "train")
        test = _extract_examples(data, "test")
        summary_lines = [
            f"ARC-style JSON task: {path.name}",
            f"Training examples: {len(train)}",
            f"Test examples: {len(test)}",
        ]
        preview_lines = []
        for index, example in enumerate(train[:2], start=1):
            preview_lines.append(f"Train {index} input:\n{_format_grid(example['input'])}")
            preview_lines.append(f"Train {index} output:\n{_format_grid(example['output'])}")
        if test:
            preview_lines.append(f"Test input:\n{_format_grid(test[0]['input'])}")
        return {
            "ok": True,
            "task_type": "arc_json",
            "path": str(path),
            "title": path.stem,
            "train": train,
            "test": test,
            "summary": "\n".join(summary_lines),
            "preview": "\n\n".join(preview_lines)[:5000],
            "raw_text": text[:12000],
        }

    return {
        "ok": True,
        "task_type": "text_reasoning",
        "path": str(path),
        "title": path.stem,
        "train": [],
        "test": [],
        "summary": f"Text reasoning task: {path.name}\nCharacters: {len(text)}",
        "preview": text[:5000],
        "raw_text": text[:12000],
    }


def build_reasoning_chain(task: dict[str, Any]) -> str:
    title = task.get("title") or "Reasoning task"
    preview = str(task.get("preview") or "")
    summary = str(task.get("summary") or "")
    train_count = len(task.get("train") or [])
    test_count = len(task.get("test") or [])
    lines = [
        f"Reasoning chain for {title}",
        "",
        "1. Describe",
        f"- Task summary: {summary.replace(chr(10), ' | ')}",
        f"- Visible evidence: {preview[:400].replace(chr(10), ' ')}",
        "",
        "2. Analyse",
        f"- Training examples available: {train_count}",
        f"- Test examples available: {test_count}",
        "- Look for shape changes, color mapping, symmetry, counting, cropping, translation, repetition, or rule composition.",
        "",
        "3. Hypothesise",
        "- Write 2 or 3 candidate rules before committing to one.",
        "- Prefer the smallest rule that explains every training pair.",
        "",
        "4. Test",
        "- Apply the rule mentally to each training input and verify the output matches exactly.",
        "- Reject rules that only explain part of the transformation.",
        "",
        "5. Answer",
        "- State the final rule clearly.",
        "- Produce the final output grid or concise answer.",
        "- Mention uncertainty if multiple rules remain plausible.",
    ]
    return "\n".join(lines)


def build_model_evaluator(task: dict[str, Any]) -> str:
    prompt_body = task.get("raw_text") or task.get("preview") or task.get("summary") or ""
    lines = [
        "Model evaluator pack",
        "",
        "Run the same task through each model with the same structure:",
        "- Step 1: describe the task",
        "- Step 2: infer candidate rules",
        "- Step 3: test each rule against training examples",
        "- Step 4: give final answer only after verification",
        "",
        "Suggested model lanes:",
        "- Gemma-4 reasoning lane: best for slower careful abstraction",
        "- Qwen 3.5 reasoning lane: faster hypothesis generation and broad pattern search",
        "- Vision lane: use only when the task is image-first or screenshot-first",
        "- OmniCoder lane: useful for structured transformation explanations or program-like reasoning",
        "",
        "Base evaluation prompt:",
        "You are solving an ARC-style reasoning task. Work in four phases: describe, hypothesise, test, answer. Do not jump to the answer before checking candidate rules against every example.",
        "",
        "Task payload:",
        str(prompt_body)[:8000],
    ]
    return "\n".join(lines)


def build_reasoning_sandbox_report(task: dict[str, Any]) -> str:
    return "\n\n".join(
        [
            str(task.get("summary") or "No task summary available."),
            build_reasoning_chain(task),
            build_model_evaluator(task),
        ]
    )


def _normalize_grid(value: Any) -> list[list[int]] | None:
    if not isinstance(value, list) or not value:
        return None
    normalized: list[list[int]] = []
    row_length = None
    for row in value:
        if not isinstance(row, list) or not row:
            return None
        normalized_row: list[int] = []
        for cell in row:
            if isinstance(cell, bool):
                return None
            if not isinstance(cell, (int, float)):
                return None
            normalized_row.append(int(cell))
        if row_length is None:
            row_length = len(normalized_row)
        elif len(normalized_row) != row_length:
            return None
        normalized.append(normalized_row)
    return normalized


def parse_grid_answer(answer_text: str) -> list[list[int]] | None:
    text = (answer_text or "").strip()
    if not text:
        return None

    fenced = text.replace("```json", "```").replace("```python", "```")
    if "```" in fenced:
        parts = fenced.split("```")
        for part in parts:
            candidate = part.strip()
            if candidate.startswith("[[") and candidate.endswith("]]"):
                try:
                    return _normalize_grid(json.loads(candidate))
                except Exception:
                    pass

    start = text.find("[[")
    end = text.rfind("]]")
    if start != -1 and end != -1 and end > start:
        candidate = text[start : end + 2]
        try:
            return _normalize_grid(json.loads(candidate))
        except Exception:
            pass

    rows: list[list[int]] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if any(character.isalpha() for character in stripped):
            continue
        values = [chunk for chunk in stripped.replace(",", " ").split() if chunk]
        if not values:
            continue
        try:
            rows.append([int(value) for value in values])
        except ValueError:
            continue
    return _normalize_grid(rows)


def score_reasoning_answer(task: dict[str, Any], answer_text: str, model_name: str = "manual") -> dict[str, Any]:
    parsed = parse_grid_answer(answer_text)
    expected_grid = None
    tests = task.get("test") or []
    if tests and isinstance(tests[0], dict):
        expected_grid = _normalize_grid(tests[0].get("output"))

    if expected_grid is None:
        return {
            "ok": False,
            "model": model_name,
            "message": "No expected test output available for scoring.",
            "parsed": parsed,
            "expected": None,
            "score": 0.0,
        }

    if parsed is None:
        return {
            "ok": False,
            "model": model_name,
            "message": "Could not parse a grid answer. Paste rows like '1 2 3' or JSON like [[1,2],[3,4]].",
            "parsed": None,
            "expected": expected_grid,
            "score": 0.0,
        }

    height_match = len(parsed) == len(expected_grid)
    width_match = all(len(parsed_row) == len(expected_row) for parsed_row, expected_row in zip(parsed, expected_grid)) if height_match else False
    total_cells = sum(len(row) for row in expected_grid)
    matched_cells = 0
    if height_match and width_match:
        for parsed_row, expected_row in zip(parsed, expected_grid):
            for parsed_cell, expected_cell in zip(parsed_row, expected_row):
                if parsed_cell == expected_cell:
                    matched_cells += 1

    exact = height_match and width_match and matched_cells == total_cells
    partial_score = (matched_cells / total_cells) if total_cells else 0.0
    return {
        "ok": exact,
        "model": model_name,
        "message": "Exact match" if exact else f"Partial score {partial_score:.2f}",
        "parsed": parsed,
        "expected": expected_grid,
        "score": 1.0 if exact else partial_score,
        "matched_cells": matched_cells,
        "total_cells": total_cells,
    }