import pandas as pd
import io
from fastapi import UploadFile, HTTPException
from app.models.schemas import DatasetColumn, PreviewResponse


SUPPORTED_TYPES = {
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
}


def _detect_dtype(series: pd.Series) -> str:
    if pd.api.types.is_numeric_dtype(series):
        return "number"
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"
    # Try to infer date from string
    if series.dtype == object:
        sample = series.dropna().head(20).astype(str)
        parsed = pd.to_datetime(sample, errors="coerce", infer_datetime_format=True)
        if parsed.notna().mean() > 0.7:
            return "datetime"
    return "string"


async def parse_upload(upload: UploadFile) -> pd.DataFrame:
    """Parse an uploaded CSV or Excel file into a DataFrame."""
    content = await upload.read()
    filename = upload.filename or ""

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        if filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(content))
        else:
            # Try multiple encodings
            for enc in ("utf-8", "latin-1", "cp1252"):
                try:
                    df = pd.read_csv(io.BytesIO(content), encoding=enc, low_memory=False)
                    break
                except UnicodeDecodeError:
                    continue
            else:
                raise HTTPException(status_code=400, detail="Cannot decode file — try saving as UTF-8 CSV.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail="File parsed but contains no data rows.")

    # Clean column names
    df.columns = [str(c).strip() for c in df.columns]

    return df


def build_preview_response(df: pd.DataFrame, filename: str) -> PreviewResponse:
    """Build a rich preview response from a DataFrame."""
    dtypes: dict[str, str] = {}
    column_details: list[DatasetColumn] = []

    for col in df.columns:
        dtype = _detect_dtype(df[col])
        dtypes[col] = dtype

        non_null = df[col].dropna()
        sample = [str(v) for v in non_null.head(5).tolist()]

        column_details.append(DatasetColumn(
            name=col,
            dtype=dtype,
            null_count=int(df[col].isna().sum()),
            unique_count=int(non_null.nunique()),
            sample_values=sample,
        ))

    preview_records = df.head(5).fillna("").astype(str).to_dict(orient="records")
    memory_mb = round(df.memory_usage(deep=True).sum() / (1024 * 1024), 2)
    missing_cells = int(df.isna().sum().sum())
    duplicate_rows = int(df.duplicated().sum())

    return PreviewResponse(
        filename=filename,
        rows=len(df),
        columns=len(df.columns),
        column_names=list(df.columns),
        dtypes=dtypes,
        preview=preview_records,
        column_details=column_details,
        memory_mb=memory_mb,
        missing_cells=missing_cells,
        duplicate_rows=duplicate_rows,
    )
