from __future__ import annotations

import argparse
import hashlib
import json
import random
import time
from pathlib import Path

import torch

from triangle_model import TriangleByteLM, VOCAB_SIZE


def main() -> None:
    parser = argparse.ArgumentParser(description="Train a new Triangle byte-level decoder LM from an authorized local corpus")
    parser.add_argument("--data", required=True, help="Path to UTF-8 text corpus with documented training rights")
    parser.add_argument("--out", required=True, help="Checkpoint output path; keep outside Git")
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
    raw = data_path.read_bytes()
    text = raw.decode("utf-8", errors="strict")
    # Byte-level tokenization is defined in this code; no downloaded tokenizer/vocabulary.
    encoded = torch.tensor([b + 3 for b in text.encode("utf-8")], dtype=torch.long)
    if len(encoded) < args.context + 2:
        raise SystemExit("Corpus too small for context; provide more authorized text")
    if args.steps < 1 or args.batch_size < 1:
        raise SystemExit("steps and batch-size must be positive")

    random.seed(args.seed)
    torch.manual_seed(args.seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(args.seed)
    device = torch.device(args.device)
    model = TriangleByteLM(width=args.width, layers=args.layers, heads=args.heads, context=args.context).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.learning_rate)
    data = encoded.to(device)
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
            "source_notice": "A checksum is provenance metadata, not proof of data rights.",
        },
    }
    torch.save(payload, output)
    print(f"Saved new randomly initialized model checkpoint: {output}")


if __name__ == "__main__":
    main()
