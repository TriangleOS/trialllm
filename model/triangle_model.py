from __future__ import annotations

import math
import torch
from torch import nn
from torch.nn import functional as F

# Byte tokenizer: ids 0,1,2 are PAD/BOS/EOS; UTF-8 bytes map to 3..258.
VOCAB_SIZE = 259


class CausalSelfAttention(nn.Module):
    def __init__(self, width: int, heads: int, dropout: float):
        super().__init__()
        if width % heads:
            raise ValueError("width must be divisible by heads")
        self.heads = heads
        self.head_width = width // heads
        self.qkv = nn.Linear(width, width * 3, bias=False)
        self.proj = nn.Linear(width, width, bias=False)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        batch, seq, width = x.shape
        q, k, v = self.qkv(x).chunk(3, dim=-1)
        def split(t: torch.Tensor) -> torch.Tensor:
            return t.view(batch, seq, self.heads, self.head_width).transpose(1, 2)
        q, k, v = split(q), split(k), split(v)
        # Built-in causal attention avoids exposing future bytes to a prediction.
        y = F.scaled_dot_product_attention(q, k, v, is_causal=True, dropout_p=self.dropout.p if self.training else 0.0)
        y = y.transpose(1, 2).contiguous().view(batch, seq, width)
        return self.dropout(self.proj(y))


class Block(nn.Module):
    def __init__(self, width: int, heads: int, dropout: float):
        super().__init__()
        self.norm1 = nn.LayerNorm(width)
        self.attn = CausalSelfAttention(width, heads, dropout)
        self.norm2 = nn.LayerNorm(width)
        self.mlp = nn.Sequential(
            nn.Linear(width, width * 4), nn.GELU(), nn.Linear(width * 4, width), nn.Dropout(dropout)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.attn(self.norm1(x))
        return x + self.mlp(self.norm2(x))


class TriangleByteLM(nn.Module):
    """Small research decoder LM; initialize new weights, no pretrained checkpoint."""

    def __init__(self, width: int = 256, layers: int = 6, heads: int = 8, context: int = 512, dropout: float = 0.0):
        super().__init__()
        self.config = {"width": width, "layers": layers, "heads": heads, "context": context, "dropout": dropout, "vocab_size": VOCAB_SIZE}
        self.token_embedding = nn.Embedding(VOCAB_SIZE, width)
        self.position_embedding = nn.Embedding(context, width)
        self.blocks = nn.ModuleList([Block(width, heads, dropout) for _ in range(layers)])
        self.norm = nn.LayerNorm(width)
        self.lm_head = nn.Linear(width, VOCAB_SIZE, bias=False)
        self.lm_head.weight = self.token_embedding.weight
        self.apply(self._init_weights)

    @staticmethod
    def _init_weights(module: nn.Module) -> None:
        if isinstance(module, nn.Linear):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)
            if module.bias is not None:
                nn.init.zeros_(module.bias)
        elif isinstance(module, nn.Embedding):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)

    def forward(self, token_ids: torch.Tensor, targets: torch.Tensor | None = None):
        _, seq = token_ids.shape
        if seq > self.config["context"]:
            raise ValueError("sequence exceeds configured context")
        positions = torch.arange(seq, device=token_ids.device)
        x = self.token_embedding(token_ids) + self.position_embedding(positions)[None, :, :]
        for block in self.blocks:
            x = block(x)
        logits = self.lm_head(self.norm(x))
        loss = None if targets is None else F.cross_entropy(logits.reshape(-1, VOCAB_SIZE), targets.reshape(-1))
        return logits, loss

    @torch.no_grad()
    def generate(self, token_ids: torch.Tensor, max_new_tokens: int = 128, temperature: float = 0.8, top_k: int = 40) -> torch.Tensor:
        for _ in range(max_new_tokens):
            ctx = token_ids[:, -self.config["context"]:]
            logits, _ = self(ctx)
            logits = logits[:, -1, :] / max(temperature, 1e-5)
            if top_k > 0:
                values, _ = torch.topk(logits, min(top_k, logits.size(-1)))
                logits[logits < values[:, [-1]]] = -math.inf
            next_id = torch.multinomial(torch.softmax(logits, dim=-1), num_samples=1)
            token_ids = torch.cat((token_ids, next_id), dim=1)
        return token_ids
