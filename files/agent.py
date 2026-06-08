"""
StatBot Pro — Autonomous CSV Analyst Agent Service.
Uses LangChain + GPT-4 with a custom sandboxed Python REPL tool.
Supports self-correction: retries on code errors up to MAX_ITERATIONS.
"""

import os
import uuid
import time
import pandas as pd
from typing import Optional

from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_core.tools import Tool
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import SystemMessage

from app.utils.sandbox import SandboxedREPL
from app.models.schemas import AnalysisResponse, AnalysisStatus, ChartInfo


SYSTEM_PROMPT = """You are StatBot Pro, an expert autonomous data analyst.
You have access to a pandas DataFrame called `df` loaded from a user-uploaded CSV file.

Your job:
1. Understand the user's analytical question.
2. Write clean, correct Python/pandas code to answer it.
3. Use the `execute_python` tool to run the code.
4. If the code produces an error, READ the error carefully, FIX the code, and try again.
5. You may iterate up to {max_iterations} times to self-correct.
6. For visualizations, use matplotlib/seaborn and call `save_chart(title="Your Chart Title")` to save the figure.
7. Always print() your final answer so it appears in the output.

DataFrame info:
{df_info}

Rules:
- NEVER use os, subprocess, open(), or any file system operations.
- NEVER use requests, urllib, or network calls.
- Only use: pandas (pd), numpy (np), matplotlib (plt), seaborn (sns), and the `save_chart` helper.
- Keep code clean and well-commented.
- If data is missing or ambiguous, state your assumptions clearly.
"""


def _build_df_info(df: pd.DataFrame) -> str:
    info_lines = [
        f"Shape: {df.shape[0]} rows × {df.shape[1]} columns",
        f"Columns: {list(df.columns)}",
        "Dtypes:",
    ]
    for col, dtype in df.dtypes.items():
        nulls = df[col].isna().sum()
        info_lines.append(f"  - {col}: {dtype} ({nulls} nulls)")
    info_lines.append("\nFirst 3 rows (as dict):")
    info_lines.append(df.head(3).to_string())
    return "\n".join(info_lines)


class CSVAnalystAgent:
    def __init__(self):
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o")
        self.max_iterations = int(os.getenv("MAX_ITERATIONS", "10"))
        self.charts_dir = os.getenv("CHARTS_DIR", "static/charts")
        self.charts_base_url = os.getenv("CHARTS_BASE_URL", "http://localhost:8000/static/charts")

    def _make_repl_tool(self, df: pd.DataFrame, repl: SandboxedREPL):
        """Create a LangChain Tool wrapping the sandboxed REPL."""
        results_store = {"charts": [], "last_output": ""}

        def run_code(code: str) -> str:
            result = repl.execute(code, df)
            results_store["charts"].extend(result.get("charts", []))

            if result["error"]:
                return f"ERROR:\n{result['error']}"

            output = result["output"] or "(Code ran successfully, no printed output)"
            results_store["last_output"] = output

            chart_notes = ""
            if result["charts"]:
                urls = [c["url"] for c in result["charts"]]
                chart_notes = f"\n\n📊 Chart(s) saved: {urls}"

            return output + chart_notes

        tool = Tool(
            name="execute_python",
            func=run_code,
            description=(
                "Execute Python/pandas code to analyze the CSV DataFrame `df`. "
                "Use save_chart(title='...') to save matplotlib figures. "
                "Returns stdout output or error messages."
            ),
        )

        return tool, results_store

    async def analyze(
        self, df: pd.DataFrame, question: str, session_id: Optional[str] = None
    ) -> AnalysisResponse:
        session_id = session_id or uuid.uuid4().hex
        start_time = time.time()

        if not self.openai_api_key:
            return AnalysisResponse(
                session_id=session_id,
                status=AnalysisStatus.ERROR,
                question=question,
                error="OPENAI_API_KEY is not configured. Please set it in backend/.env",
            )

        repl = SandboxedREPL(self.charts_dir, self.charts_base_url)
        tool, results_store = self._make_repl_tool(df, repl)

        df_info = _build_df_info(df)
        system_msg = SYSTEM_PROMPT.format(
            df_info=df_info, max_iterations=self.max_iterations
        )

        llm = ChatOpenAI(
            model=self.model,
            temperature=0,
            api_key=self.openai_api_key,
        )

        prompt = ChatPromptTemplate.from_messages(
            [
                SystemMessage(content=system_msg),
                MessagesPlaceholder(variable_name="chat_history", optional=True),
                ("human", "{input}"),
                MessagesPlaceholder(variable_name="agent_scratchpad"),
            ]
        )

        agent = create_openai_tools_agent(llm, [tool], prompt)
        executor = AgentExecutor(
            agent=agent,
            tools=[tool],
            max_iterations=self.max_iterations,
            verbose=True,
            handle_parsing_errors=True,
            return_intermediate_steps=True,
        )

        try:
            result = await executor.ainvoke({"input": question})
            answer = result.get("output", "No answer generated.")

            # Collect all code snippets from intermediate steps
            code_snippets = []
            for action, _ in result.get("intermediate_steps", []):
                if hasattr(action, "tool_input"):
                    code_snippets.append(action.tool_input)

            charts = [
                ChartInfo(**c) for c in results_store["charts"]
            ]

            elapsed_ms = int((time.time() - start_time) * 1000)

            return AnalysisResponse(
                session_id=session_id,
                status=AnalysisStatus.SUCCESS,
                question=question,
                answer=answer,
                charts=charts,
                code_executed="\n\n# --- next iteration ---\n\n".join(code_snippets),
                iterations=len(result.get("intermediate_steps", [])),
                execution_time_ms=elapsed_ms,
            )

        except Exception as e:
            elapsed_ms = int((time.time() - start_time) * 1000)
            return AnalysisResponse(
                session_id=session_id,
                status=AnalysisStatus.ERROR,
                question=question,
                error=str(e),
                execution_time_ms=elapsed_ms,
            )
