from __future__ import annotations

import argparse
import hashlib
import json
import random
import time
from pathlib import Path

import torch

from manifest import ManifestError, load_and_check
from triangle_model import TriangleByteLM, VOCAB_SIZE


@torch.no_grad()
def evaluate(model: TriangleByteLM, ids: torch.Tensor, context: int, batch_size: int, max_windows: int = 64) -> float:
    """Mean next-byte loss over non-overlapping windows of the held-out tail."""
    model.eval()
    starts = list(range(0, len(ids) - context - 1, context))[:max_windows]
    losses = []
    for i in range(0, len(starts), batch_size):
        batch = starts[i:i + batch_size]
        x = torch.stack([ids[s:s + context] for s in batch])
        y = torch.stack([ids[s + 1:s + context + 1] for s in batch])
        _, loss = model(x, y)
        losses.append(float(loss))
    model.train()
    return sum(losses) / len(losses)


def main() -> None:
    parser = argparse.ArgumentParser(description="Train a new Triangle byte-level decoder LM from an authorized local corpus")
    parser.add_argument("--data", required=True, help="Path to UTF-8 text corpus with documented training rights")
    parser.add_argument("--manifest", required=True, help="Corpus manifest JSON (see corpus-manifest.example.json)")
    parser.add_argument("--out", required=True, help="Checkpoint output path; keep outside Git")
    parser.add_argument("--eval-fraction", type=float, default=0.1, help="Tail of the corpus held out for evaluation")
    parser.add_argument("--steps", type=int, default=1000)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--context", type=int, default=256)
    parser.add_argument("--width", type=int, default=128)
    parser.add_argument("--layers", type=int, default=4)
    parser.add_argument("--heads", type=int, default=4)
    parser.add_argument("--learning-rate", type=float, default=3e-4)
    parser.add_argument("--seed", type=int, default=1729)
    parser.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    args = parser.parse_args()

    data_path = Path(args.data).resolve()
    try:
        manifest = load_and_check(Path(args.manifest).resolve(), data_path)
    except ManifestError as exc:
        raise SystemExit(f"Refusing to train: {exc}")
    if not 0.0 < args.eval_fraction < 0.5:
        raise SystemExit("eval-fraction must be between 0 and 0.5")
    raw = data_path.read_bytes()
    text = raw.decode("utf-8", errors="strict")
    # Byte-level tokenization is defined in this code; no downloaded tokenizer/vocabulary.
    encoded = torch.tensor([b + 3 for b in text.encode("utf-8")], dtype=torch.long)
    # Contiguous split: the held-out tail never overlaps any training window.
    split = int(len(encoded) * (1 - args.eval_fraction))
    train_ids, eval_ids = encoded[:split], encoded[split:]
    if len(train_ids) < args.context + 2 or len(eval_ids) < args.context + 2:
        raise SystemExit("Corpus too small for context and eval split; provide more authorized text")
    if args.steps < 1 or args.batch_size < 1:
        raise SystemExit("steps and batch-size must be positive")

    random.seed(args.seed)
    torch.manual_seed(args.seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(args.seed)
    device = torch.device(args.device)
    model = TriangleByteLM(width=args.width, layers=args.layers, heads=args.heads, context=args.context).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.learning_rate)
    data = train_ids.to(device)
    held_out = eval_ids.to(device)
    started = time.time()

    model.train()
    for step in range(args.steps):
        starts = torch.randint(0, len(data) - args.context - 1, (args.batch_size,), device=device)
        x = torch.stack([data[s:s + args.context] for s in starts])
        y = torch.stack([data[s + 1:s + args.context + 1] for s in starts])
        _, loss = model(x, y)
        assert loss is not None
        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        if step % 100 == 0 or step == args.steps - 1:
            print(json.dumps({"step": step, "loss": round(float(loss.detach()), 5)}), flush=True)

    eval_loss = evaluate(model, held_out, args.context, args.batch_size)
    print(json.dumps({"eval_loss": round(eval_loss, 5)}), flush=True)

    output = Path(args.out).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "format": "triangle-byte-lm-v1",
        "model_config": model.config,
        "model_state_dict": model.cpu().state_dict(),
        "tokenizer": {"type": "utf8-byte-v1", "pad": 0, "bos": 1, "eos": 2, "byte_offset": 3, "vocab_size": VOCAB_SIZE},
        "training_provenance": {
            "corpus_sha256": hashlib.sha256(raw).hexdigest(),
            "corpus_path_basename": data_path.name,
            "steps": args.steps,
            "batch_size": args.batch_size,
            "seed": args.seed,
            "learning_rate": args.learning_rate,
            "elapsed_seconds": round(time.time() - started, 2),
            "eval_fraction": args.eval_fraction,
            "eval_loss": round(eval_loss, 5),
            "manifest_owner": manifest["owner"],
            "manifest_approved_by": manifest["approved_by"],
            "manifest_approved_on": manifest["approved_on"],
            "manifest_sha256": hashlib.sha256(Path(args.manifest).read_bytes()).hexdigest(),
            "source_notice": "A checksum is provenance metadata, not proof of data rights.",
        },
    }
    torch.save(payload, output)
    print(f"Saved checkpoint trained for {args.steps} steps: {output}")


if __name__ == "__main__":
    main()
