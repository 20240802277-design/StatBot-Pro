"""
Sandboxed Python REPL for safe agent code execution.

Blocks: os, sys, subprocess, socket, requests, open(), eval, __import__, etc.
Allows: pandas, numpy, matplotlib, seaborn, math, re, json, datetime, save_chart()
"""

import base64
import io
import traceback
import uuid
import os
import re
import math
import json
import datetime

import matplotlib
matplotlib.use("Agg")   # non-interactive backend
import matplotlib.pyplot as plt

# ── Banned module patterns ────────────────────────────────────────
BANNED_MODULES = {
    "os", "sys", "subprocess", "shutil", "socket",
    "requests", "urllib", "http", "ftplib", "smtplib",
    "pathlib", "glob", "pickle", "shelve", "sqlite3",
    "ctypes", "cffi", "importlib", "builtins",
}

BANNED_PATTERNS = [
    r"\bopen\s*\(",
    r"\beval\s*\(",
    r"\bexec\s*\(",
    r"\bcompile\s*\(",
    r"\b__import__\s*\(",
    r"\bgetattr\s*\(.*__",
    r"\bsetattr\s*\(",
    r"\bdelattr\s*\(",
    r"\bbreakpoint\s*\(",
    r"import\s+(" + "|".join(BANNED_MODULES) + r")\b",
    r"from\s+(" + "|".join(BANNED_MODULES) + r")\s+import",
]

COMPILED_PATTERNS = [re.compile(p) for p in BANNED_PATTERNS]


class SecurityError(Exception):
    pass


def _static_scan(code: str) -> None:
    """Pre-execution static analysis — raises SecurityError if dangerous patterns found."""
    for pattern in COMPILED_PATTERNS:
        if pattern.search(code):
            raise SecurityError(
                f"Blocked: code contains a disallowed pattern ({pattern.pattern!r})."
            )


def execute_safe(code: str, df_or_dfs) -> dict:
    """
    Execute `code` in a restricted namespace with df/dfs injected.
    Returns:
        {"output": str, "charts": [base64_png, ...], "error": None | str}
    """
    # ── Static scan ──
    try:
        _static_scan(code)
    except SecurityError as e:
        return {"output": "", "charts": [], "error": f"SecurityError: {e}"}

    # ── Collect chart images ──
    charts_b64: list[str] = []
    chart_titles: list[str] = []

    def save_chart(title: str = "") -> None:
        buf = io.BytesIO()
        plt.savefig(buf, format="png", dpi=120, bbox_inches="tight",
                    facecolor="#0d1117", edgecolor="none")
        buf.seek(0)
        charts_b64.append(base64.b64encode(buf.read()).decode("utf-8"))
        chart_titles.append(title)
        plt.close("all")

    # ── Capture stdout ──
    output_buf = io.StringIO()

    def safe_print(*args, **kwargs):
        print(*args, **kwargs, file=output_buf)

    # ── Restricted namespace ──
    namespace = {
        "__builtins__": {
            "abs": abs, "all": all, "any": any, "bool": bool,
            "dict": dict, "dir": dir, "enumerate": enumerate,
            "filter": filter, "float": float, "format": format,
            "frozenset": frozenset, "getattr": getattr,
            "hasattr": hasattr, "hash": hash, "int": int,
            "isinstance": isinstance, "issubclass": issubclass,
            "iter": iter, "len": len, "list": list, "map": map,
            "max": max, "min": min, "next": next, "object": object,
            "print": safe_print, "range": range, "repr": repr,
            "reversed": reversed, "round": round, "set": set,
            "slice": slice, "sorted": sorted, "str": str, "sum": sum,
            "tuple": tuple, "type": type, "vars": vars, "zip": zip,
            "True": True, "False": False, "None": None,
        },
        "pd":          __import__("pandas"),
        "np":          __import__("numpy"),
        "plt":         plt,
        "sns":         __import__("seaborn"),
        "math":        math,
        "re":          re,
        "json":        json,
        "datetime":    datetime,
        "save_chart":  save_chart,
        "uuid":        uuid,
    }

    # ── Apply matplotlib dark theme ──
    plt.style.use("dark_background")
    plt.rcParams.update({
        "axes.facecolor":   "#0d1117",
        "figure.facecolor": "#0d1117",
        "axes.edgecolor":   "#30363d",
        "grid.color":       "#21262d",
        "text.color":       "#e6edf3",
        "axes.labelcolor":  "#8b949e",
        "xtick.color":      "#8b949e",
        "ytick.color":      "#8b949e",
        "font.family":      "sans-serif",
        "font.size":        10,
    })

    # ── Inject DataFrames ──
    if isinstance(df_or_dfs, dict):
        for name, sub_df in df_or_dfs.items():
            safe_name = re.sub(r'[^a-zA-Z0-9_]', '_', name)
            namespace[safe_name] = sub_df
        namespace["dfs"] = df_or_dfs
        if df_or_dfs:
            first_key = list(df_or_dfs.keys())[0]
            namespace["df"] = df_or_dfs[first_key]
    else:
        namespace["df"] = df_or_dfs

    # ── Execute ──
    try:
        exec(code, namespace)   # noqa: S102
        plt.close("all")
        return {
            "output":  output_buf.getvalue(),
            "charts":  list(zip(charts_b64, chart_titles)),
            "error":   None,
        }
    except Exception:
        plt.close("all")
        return {
            "output": output_buf.getvalue(),
            "charts": list(zip(charts_b64, chart_titles)),
            "error":  traceback.format_exc(limit=6),
        }
