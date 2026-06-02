"""
LangChain autonomous agent for CSV data analysis.

Flow:
  1. Receive question + DataFrame
  2. Agent builds a plan, writes pandas/matplotlib code
  3. Code runs in the sandboxed REPL
  4. On error → agent sees the traceback and retries (self-correction)
  5. Returns: answer (str), code (str), charts (list[base64])
"""

import os
import json
import textwrap
import pandas as pd

from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain.tools import tool
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage

from app.utils.sandbox import execute_safe
from app.models.schemas import ChartData


# ── System prompt ─────────────────────────────────────────────────
SYSTEM_PROMPT = """You are StatBotPro, an expert autonomous data analyst.
You have access to a pandas DataFrame called `df` already loaded in memory.
Your job is to answer the user's analytical question accurately, using Python/pandas code.

Rules:
- ALWAYS use the `run_code` tool to execute Python code. Never fake results.
- Use `save_chart(title)` instead of plt.show() to capture charts as images.
- If code execution fails, study the error, fix the code, and retry.
- Be concise in your final answer — lead with the key insight, then details.
- Format numbers with commas/decimal places for readability.
- Use markdown in your answer: **bold**, `code`, bullet lists.
- After running code, synthesize a clear, insightful answer.
- Maximum {max_iterations} total tool calls per question.

DataFrame info will be provided in the first human message.
"""

_CONVERSATION_STORE: dict[str, list] = {}


def _build_df_summary(df_or_dfs) -> str:
    """Build a compact DataFrame summary for the agent."""
    import re
    if isinstance(df_or_dfs, dict):
        lines = ["Multiple datasets are loaded and available in memory:", ""]
        for name, df in df_or_dfs.items():
            safe_var = re.sub(r'[^a-zA-Z0-9_]', '_', name)
            lines.append(f"Dataset Name: {name!r}")
            lines.append(f"  Variable name to use in code: `{safe_var}`")
            lines.append(f"  Shape: {df.shape[0]:,} rows × {df.shape[1]} columns")
            lines.append(f"  Columns: {', '.join(df.columns.tolist())}")
            lines.append("  dtypes:")
            for col in df.columns:
                null_pct = round(df[col].isna().mean() * 100, 1)
                lines.append(f"    {col!r}: {df[col].dtype} (null: {null_pct}%)")
            lines.append("")
        return "\n".join(lines)
    else:
        df = df_or_dfs
        lines = [
            f"Shape: {df.shape[0]:,} rows × {df.shape[1]} columns",
            f"Columns: {', '.join(df.columns.tolist())}",
            "",
            "dtypes:",
        ]
        for col in df.columns:
            null_pct = round(df[col].isna().mean() * 100, 1)
            lines.append(f"  {col!r}: {df[col].dtype} (null: {null_pct}%)")

        lines += ["", "First 3 rows (as JSON):"]
        lines.append(df.head(3).fillna("").to_json(orient="records", indent=2))
        return "\n".join(lines)


def run_agent(
    df_or_dfs,
    question: str,
    session_id: str,
) -> dict:
    """
    Run the LangChain agent.
    Returns: {"answer": str, "code": str, "charts": list[ChartData]}
    """
    import re
    api_key = os.getenv("OPENAI_API_KEY", "")
    model   = os.getenv("OPENAI_MODEL", "gpt-4o")
    max_iter = int(os.getenv("MAX_ITERATIONS", "10"))
    base_url = os.getenv("OPENAI_API_BASE", None)

    if not api_key or api_key.startswith("sk-your"):
        return _demo_response(df_or_dfs, question)

    if api_key.startswith("sk-or-v1-"):
        if not base_url:
            base_url = "https://openrouter.ai/api/v1"
        if model in ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"]:
            model = f"openai/{model}"

    llm_kwargs = {
        "model": model,
        "temperature": 0,
        "api_key": api_key,
        "max_tokens": int(os.getenv("MAX_TOKENS", "250")),
    }
    if base_url:
        llm_kwargs["base_url"] = base_url

    llm = ChatOpenAI(**llm_kwargs)

    # ── Tool: run_code ──────────────────────────────────────────
    all_charts: list[tuple[str, str]] = []   # (b64, title)
    latest_code: list[str] = [""]

    @tool
    def run_code(code: str) -> str:
        """Execute Python code against the loaded DataFrames. Returns stdout + errors."""
        latest_code[0] = code
        result = execute_safe(code, df_or_dfs)
        all_charts.extend(result.get("charts", []))

        if result["error"]:
            return f"ERROR:\n{result['error']}\nSTDOUT:\n{result['output']}"
        output = result["output"] or "(no output — use print() to show results)"
        return f"SUCCESS:\n{output}"

    # ── Prompt ─────────────────────────────────────────────────
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT.format(max_iterations=max_iter)),
        MessagesPlaceholder("chat_history"),
        ("human", "{input}"),
        MessagesPlaceholder("agent_scratchpad"),
    ])

    agent = create_openai_tools_agent(llm, [run_code], prompt)
    executor = AgentExecutor(
        agent=agent,
        tools=[run_code],
        max_iterations=max_iter,
        verbose=False,
        handle_parsing_errors=True,
        return_intermediate_steps=True,
    )

    # ── Conversation history ────────────────────────────────────
    history = _CONVERSATION_STORE.get(session_id, [])
    df_summary = _build_df_summary(df_or_dfs)

    first_message = f"DataFrame summary:\n```\n{df_summary}\n```\n\nQuestion: {question}"

    try:
        result = executor.invoke({
            "input": first_message,
            "chat_history": history,
        })
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"AGENT ERROR TRACEBACK:\n{tb}")
        return {"answer": f"Agent error: {str(e)}\n\n{tb}", "code": "", "charts": [], "iterations": 0}

    answer = result.get("output", "")
    steps  = result.get("intermediate_steps", [])
    iterations = len(steps)

    # Update conversation history
    history.append(HumanMessage(content=question))
    history.append(AIMessage(content=answer))
    _CONVERSATION_STORE[session_id] = history[-20:]   # keep last 20 messages

    # Build ChartData list
    charts = [
        ChartData(type="image", data=b64, title=title or f"Chart {i+1}")
        for i, (b64, title) in enumerate(all_charts)
    ]

    return {
        "answer":     answer,
        "code":       latest_code[0],
        "charts":     charts,
        "iterations": iterations,
    }


def _demo_response(df_or_dfs, question: str) -> dict:
    """Return a rich demo response when no API key is configured."""
    import textwrap
    if isinstance(df_or_dfs, dict):
        total_rows = sum(df.shape[0] for df in df_or_dfs.values())
        datasets_str = "\n".join([f"- `{name}`: {df.shape[0]:,} rows × {df.shape[1]} columns" for name, df in df_or_dfs.items()])
        answer = textwrap.dedent(f"""
            **Demo Mode** — No OpenAI API key configured.

            Your question: *"{question}"*

            **Multiple Datasets loaded ({len(df_or_dfs)} files):**
            {datasets_str}

            To get real AI-powered multi-file analysis:
            1. Set `OPENAI_API_KEY` in `backend/.env`
            2. Restart the backend server
            3. Ask your question again

            The LangChain agent will then join and analyze your datasets using pandas.
        """).strip()
        demo_code = textwrap.dedent(f"""
            # Demo multi-file code
            import pandas as pd
            for name, df in dfs.items():
                print(name, df.shape)
        """).strip()
    else:
        df = df_or_dfs
        rows, cols = df.shape
        col_names = df.columns.tolist()

        answer = textwrap.dedent(f"""
            **Demo Mode** — No OpenAI API key configured.

            Your question: *"{question}"*

            **Dataset loaded:** {rows:,} rows × {cols} columns

            **Columns detected:** {', '.join(f'`{c}`' for c in col_names[:8])}{'...' if len(col_names) > 8 else ''}

            To get real AI-powered analysis:
            1. Set `OPENAI_API_KEY` in `backend/.env`
            2. Restart the backend server
            3. Ask your question again

            The LangChain agent will then write pandas code, execute it safely, and return insights + charts.
        """).strip()

        demo_code = textwrap.dedent(f"""
            # Demo code — real agent would generate this dynamically
            import pandas as pd

            print(df.shape)
            print(df.dtypes)
            print(df.describe())
        """).strip()

    return {"answer": answer, "code": demo_code, "charts": [], "iterations": 0}
