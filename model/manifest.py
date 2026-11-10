"""Corpus manifest checks (Gate 0). A manifest records who may use the data and why.

A passing check means the paperwork is filled in and matches the file. It is not legal
advice and does not prove the rights exist; that is what the dataset register and
counsel review are for.
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

RIGHTS_BASES = {"owned", "licensed", "consented", "commissioned"}


class ManifestError(ValueError):
    pass


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def load_and_check(manifest_path: Path, corpus_path: Path) -> dict:
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ManifestError(f"cannot read manifest: {exc}") from exc
    if not isinstance(manifest, dict):
        raise ManifestError("manifest must be a JSON object")

    for field in ("corpus_sha256", "owner", "approved_by", "approved_on", "sources"):
        if not manifest.get(field):
            raise ManifestError(f"manifest is missing {field}")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(manifest["approved_on"])):
        raise ManifestError("approved_on must be YYYY-MM-DD")
    actual = sha256_file(corpus_path)
    if manifest["corpus_sha256"].lower() != actual:
        raise ManifestError(f"corpus checksum does not match manifest (file is {actual})")

    sources = manifest["sources"]
    if not isinstance(sources, list) or not sources:
        raise ManifestError("sources must be a non-empty list")
    for i, src in enumerate(sources):
        if not isinstance(src, dict):
            raise ManifestError(f"sources[{i}] must be an object")
        for field in ("name", "rights_basis", "evidence"):
            if not src.get(field):
                raise ManifestError(f"sources[{i}] is missing {field}")
        if src["rights_basis"] not in RIGHTS_BASES:
            raise ManifestError(f"sources[{i}].rights_basis must be one of {sorted(RIGHTS_BASES)}")
        if src.get("contains_personal_data") is not False and not src.get("personal_data_basis"):
            raise ManifestError(f"sources[{i}] may hold personal data: set contains_personal_data false or give personal_data_basis")
    return manifest
