"""
Sandboxed Python REPL Tool for StatBot Pro.
Executes pandas/matplotlib code in a restricted environment.
"""

import io
import sys
import os
import uuid
import contextlib
import traceback
from typing import Optional
from datetime import datetime


# Blocked dangerous built-ins and modules
BLOCKED_BUILTINS = {
    "__import__",
    "eval",
    "exec",
    "compile",
    "open",
    "input",
    "breakpoint",
}

BLOCKED_MODULES = {
    "os",
    "sys",
    "subprocess",
    "shutil",
    "pathlib",
    "socket",
    "urllib",
    "http",
    "requests",
    "ftplib",
    "smtplib",
    "pickle",
    "shelve",
    "ctypes",
    "multiprocessing",
    "threading",
    "importlib",
    "glob",
}


class SandboxViolationError(Exception):
    pass


def _create_safe_globals(df, charts_dir: str, charts_base_url: str) -> dict:
    """
    Build a restricted globals dict that exposes only safe libraries.
    """
    import pandas as pd
    import numpy as np
    import matplotlib
    matplotlib.use("Agg")  # non-interactive backend
    import matplotlib.pyplot as plt
    import seaborn as sns

    generated_charts = []

    def safe_savefig(title: Optional[str] = None):
        """Save current matplotlib figure and return public URL."""
        filename = f"chart_{uuid.uuid4().hex[:8]}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        filepath = os.path.join(charts_dir, filename)
        plt.tight_layout()
        plt.savefig(filepath, dpi=150, bbox_inches="tight", facecolor="white")
        plt.close("all")
        url = f"{charts_base_url}/{filename}"
        generated_charts.append({"filename": filename, "url": url, "title": title or "Chart"})
        return url

    safe_globals = {
        "__builtins__": {
            k: v
            for k, v in __builtins__.items()  # type: ignore
            if k not in BLOCKED_BUILTINS
        }
        if isinstance(__builtins__, dict)
        else {
            k: getattr(__builtins__, k)
            for k in dir(__builtins__)
            if k not in BLOCKED_BUILTINS
        },
        "pd": pd,
        "np": np,
        "plt": plt,
        "sns": sns,
        "df": df,
        "save_chart": safe_savefig,
        "_generated_charts": generated_charts,
        "print": print,
    }

    return safe_globals


class SandboxedREPL:
    """
    Executes Python/Pandas code safely in a sandboxed namespace.
    Blocks OS, subprocess, and file system access.
    """

    def __init__(self, charts_dir: str, charts_base_url: str):
        self.charts_dir = charts_dir
        self.charts_base_url = charts_base_url
        os.makedirs(charts_dir, exist_ok=True)

    def execute(self, code: str, df) -> dict:
        """
        Execute code against the dataframe.
        Returns: { output, charts, error }
        """
        # Static analysis — block dangerous patterns
        self._static_check(code)

        safe_globals = _create_safe_globals(self.charts_dir, self.charts_base_url)
        safe_globals["df"] = df  # inject the real dataframe

        stdout_capture = io.StringIO()
        error = None
        output = ""

        try:
            with contextlib.redirect_stdout(stdout_capture):
                exec(compile(code, "<sandbox>", "exec"), safe_globals)  # noqa: S102
            output = stdout_capture.getvalue()
        except SandboxViolationError as e:
            error = f"🚫 Sandbox violation: {e}"
        except Exception:
            error = traceback.format_exc()

        charts = safe_globals.get("_generated_charts", [])

        return {
            "output": output,
            "charts": charts,
            "error": error,
        }

    def _static_check(self, code: str):
        """Raise if code contains obviously dangerous patterns."""
        lower = code.lower()
        dangerous_patterns = [
            "os.system",
            "os.popen",
            "subprocess",
            "shutil.rmtree",
            "__import__",
            "open(",
            "socket.",
            "requests.",
            "urllib.",
        ]
        for pattern in dangerous_patterns:
            if pattern in lower:
                raise SandboxViolationError(
                    f"Pattern '{pattern}' is not allowed in the sandbox."
                )
