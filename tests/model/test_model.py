import importlib
import json
import subprocess
import sys
from pathlib import Path

import pytest
import torch

from manifest import ManifestError, load_and_check, sha256_file
from triangle_model import VOCAB_SIZE, TriangleByteLM

MODEL_DIR = Path(__file__).resolve().parents[2] / "model"
TOKEN = "x" * 40


def write_corpus(tmp_path: Path) -> Path:
    corpus = tmp_path / "corpus.txt"
    corpus.write_text("user: hello\nassistant: hi there, this is a tiny test corpus.\n" * 80, encoding="utf-8")
    return corpus


def write_manifest(tmp_path: Path, corpus: Path, **overrides) -> Path:
    manifest = {
        "corpus_sha256": sha256_file(corpus),
        "owner": "Finsec Associates Limited",
        "approved_by": "Test",
        "approved_on": "2026-11-10",
        "sources": [{"name": "test", "rights_basis": "owned", "evidence": "written for the test", "contains_personal_data": False}],
    }
    manifest.update(overrides)
    path = tmp_path / "manifest.json"
    path.write_text(json.dumps(manifest), encoding="utf-8")
    return path


def test_forward_shapes_and_causality():
    torch.manual_seed(0)
    model = TriangleByteLM(width=32, layers=2, heads=4, context=16).eval()
    x = torch.randint(3, VOCAB_SIZE, (2, 10))
    logits, loss = model(x, x)
    assert logits.shape == (2, 10, VOCAB_SIZE)
    assert loss is not None
    # Changing a later byte must not change earlier predictions.
    y = x.clone()
    y[:, -1] = 5
    assert torch.allclose(model(x)[0][:, :-1], model(y)[0][:, :-1], atol=1e-5)


def test_generate_respects_context_window():
    model = TriangleByteLM(width=32, layers=1, heads=4, context=8).eval()
    out = model.generate(torch.randint(3, VOCAB_SIZE, (1, 20)), max_new_tokens=5)
    assert out.shape == (1, 25)


def test_manifest_checks(tmp_path):
    corpus = write_corpus(tmp_path)
    assert load_and_check(write_manifest(tmp_path, corpus), corpus)["owner"]
    with pytest.raises(ManifestError, match="checksum"):
        load_and_check(write_manifest(tmp_path, corpus, corpus_sha256="0" * 64), corpus)
    with pytest.raises(ManifestError, match="rights_basis"):
        load_and_check(write_manifest(tmp_path, corpus, sources=[{"name": "web", "rights_basis": "scraped", "evidence": "x", "contains_personal_data": False}]), corpus)
    with pytest.raises(ManifestError, match="personal data"):
        load_and_check(write_manifest(tmp_path, corpus, sources=[{"name": "chat logs", "rights_basis": "owned", "evidence": "x"}]), corpus)


def run_train(tmp_path, corpus, manifest, out):
    return subprocess.run(
        [sys.executable, "train.py", "--data", str(corpus), "--manifest", str(manifest), "--out", str(out),
         "--steps", "3", "--batch-size", "2", "--context", "32", "--width", "32", "--layers", "1", "--heads", "4", "--device", "cpu"],
        cwd=MODEL_DIR, capture_output=True, text=True,
    )


def test_train_refuses_without_valid_manifest(tmp_path):
    corpus = write_corpus(tmp_path)
    bad = write_manifest(tmp_path, corpus, corpus_sha256="0" * 64)
    result = run_train(tmp_path, corpus, bad, tmp_path / "ckpt.pt")
    assert result.returncode != 0
    assert "Refusing to train" in result.stderr
    assert not (tmp_path / "ckpt.pt").exists()


@pytest.fixture(scope="module")
def checkpoint(tmp_path_factory):
    tmp_path = tmp_path_factory.mktemp("ckpt")
    corpus = write_corpus(tmp_path)
    out = tmp_path / "ckpt.pt"
    result = run_train(tmp_path, corpus, write_manifest(tmp_path, corpus), out)
    assert result.returncode == 0, result.stderr
    assert '"eval_loss"' in result.stdout
    return out


def test_checkpoint_has_provenance(checkpoint):
    payload = torch.load(checkpoint, map_location="cpu", weights_only=True)
    assert payload["format"] == "triangle-byte-lm-v1"
    prov = payload["training_provenance"]
    assert prov["manifest_owner"] == "Finsec Associates Limited"
    assert "eval_loss" in prov and len(prov["corpus_sha256"]) == 64


@pytest.fixture()
def client(checkpoint, monkeypatch):
    from fastapi.testclient import TestClient

    monkeypatch.setenv("TRIANGLE_MODEL_CHECKPOINT", str(checkpoint))
    monkeypatch.setenv("TRIANGLE_REGION_ID", "uk-1")
    monkeypatch.setenv("TRIANGLE_INFERENCE_TOKEN", TOKEN)
    monkeypatch.setenv("TRIANGLE_MODEL_DEVICE", "cpu")
    sys.modules.pop("serve", None)
    serve = importlib.import_module("serve")
    return TestClient(serve.app)


BODY = {"messages": [{"role": "user", "content": "hello"}], "max_tokens": 8}


def test_serve_requires_service_token_and_region(client):
    assert client.post("/v1/chat/completions", json=BODY).status_code == 401
    assert client.post("/v1/chat/completions", json=BODY, headers={"Authorization": "Bearer wrong", "X-Triangle-Region": "uk-1"}).status_code == 401
    assert client.post("/v1/chat/completions", json=BODY, headers={"Authorization": f"Bearer {TOKEN}", "X-Triangle-Region": "za-1"}).status_code == 403


def test_serve_completion_shape(client):
    res = client.post("/v1/chat/completions", json={**BODY, "temperature": 0}, headers={"Authorization": f"Bearer {TOKEN}", "X-Triangle-Region": "uk-1"})
    assert res.status_code == 200
    body = res.json()
    assert body["object"] == "chat.completion"
    assert body["choices"][0]["message"]["role"] == "assistant"
    assert body["choices"][0]["finish_reason"] in {"stop", "length"}
    assert body["usage"]["prompt_tokens"] > 0
    assert "Research prototype" in body["notice"]


def test_serve_rejects_streaming(client):
    res = client.post("/v1/chat/completions", json={**BODY, "stream": True}, headers={"Authorization": f"Bearer {TOKEN}", "X-Triangle-Region": "uk-1"})
    assert res.status_code == 501
