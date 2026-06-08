from pydantic import BaseModel, Field
from typing import Optional, Literal
from enum import Enum
import uuid


class AnalysisRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000, description="The analytical question to answer")
    session_id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()), description="Session identifier for conversation continuity")


class AnalysisStatus(str, Enum):
    SUCCESS = "success"
    ERROR = "error"


class ChartInfo(BaseModel):
    filename: str
    url: str
    title: str


class AnalysisResponse(BaseModel):
    session_id: str
    status: AnalysisStatus
    question: str
    answer: Optional[str] = None
    code_executed: Optional[str] = None
    charts: list[ChartInfo] = Field(default_factory=list)
    iterations: int = 0
    error: Optional[str] = None
    execution_time_ms: Optional[int] = None


class DatasetColumn(BaseModel):
    name: str
    dtype: Literal["number", "datetime", "string", "unknown"]
    null_count: int = 0
    unique_count: int = 0
    sample_values: list[str] = Field(default_factory=list)


class PreviewResponse(BaseModel):
    filename: str
    rows: int
    columns: int
    column_names: list[str]
    dtypes: dict[str, str]
    preview: list[dict]
    column_details: list[DatasetColumn] = Field(default_factory=list)
    memory_mb: float = 0.0
    missing_cells: int = 0
    duplicate_rows: int = 0


class HealthResponse(BaseModel):
    status: Literal["ok"]
    version: str
    uptime_seconds: float
    openai_configured: bool
