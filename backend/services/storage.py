"""Local-filesystem object storage for artifact bytes.

Bytes live under ``data/artifacts/<company_id>/`` keyed by a server-generated
UUID ``stored_filename``. This module owns all file I/O; it has no HTTP or
database logic.
"""

import uuid
from pathlib import Path

from backend.config import ARTIFACTS_DIR


def company_dir(company_id: int) -> Path:
    return ARTIFACTS_DIR / str(company_id)


def stored_path(company_id: int, stored_filename: str) -> Path:
    return company_dir(company_id) / stored_filename


def new_stored_filename(original_name: str) -> str:
    """Server-generated UUID (with the original extension) so on-disk names are
    unique and never collide across companies or re-uploads."""
    suffix = Path(original_name or "").suffix
    return f"{uuid.uuid4().hex}{suffix}"


def save(company_id: int, stored_filename: str, content: bytes) -> Path:
    d = company_dir(company_id)
    d.mkdir(parents=True, exist_ok=True)
    path = d / stored_filename
    path.write_bytes(content)
    return path


def read(company_id: int, stored_filename: str) -> Path:
    return stored_path(company_id, stored_filename)


def delete(company_id: int, stored_filename: str) -> None:
    path = stored_path(company_id, stored_filename)
    if path.exists():
        path.unlink()


def delete_company_dir(company_id: int) -> None:
    d = company_dir(company_id)
    if d.exists():
        for p in d.iterdir():
            if p.is_file():
                p.unlink()
        d.rmdir()
