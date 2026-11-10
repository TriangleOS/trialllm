# Proprietary model program — required gates

This document is an implementation and governance checklist, not a legal opinion or a claim that Triangle already owns model weights.

## Definition of the goal

“From scratch” here means model parameters are initialized randomly and learned from an authorized Triangle-controlled corpus; no pretrained model weights or downloaded corpus are used. Open-source runtime libraries and cloud infrastructure can still be dependencies. Record these separately. A proprietary product/service may use third-party licensed components, but “Triangle-owned model weights” and “proprietary product” are different claims.

## Gate 0 — authority and data rights

Before collecting or training:

- Identify the legal entity that will own code, datasets, tokenizer/configuration and trained checkpoints.
- Obtain signed IP assignment/work-for-hire terms from staff and contractors, including inventions, datasets, annotations and model outputs where enforceable.
- Create a dataset register: source/owner, collection dates, license/contract, consent, purpose, jurisdictions, language, personal/sensitive data, permitted model-training use, retention/deletion path, and restrictions.
- Exclude data without documented rights. Do not use scraped, public, customer, employee, or user content merely because it is accessible.
- Obtain privacy, copyright, database-rights, labor/employment and data-protection review for every intended market. Document opt-out/deletion and how training data can/cannot be removed from a trained model.

## Gate 1 — model specification and evaluation

- Select model scale only after compute, latency, memory and budget planning. The supplied 8M-parameter research model is a smoke-test design, not an adequate market-ready assistant.
- Define target languages, dialects, scripts, tasks and quality/safety requirements with in-country linguists and communities. Do not make broad “African-language capable” claims without per-language evidence.
- Build held-out evaluation sets that are lawful, consented, versioned and separated from training. Include toxicity, misinformation, security, memorization, prompt-injection, and demographic/error analyses.
- Record architecture, hyperparameters, source commit, seed, data-manifest hash, tokenizer version, training logs, hardware, checkpoints and evaluation results. Keep sensitive dataset content private.

## Gate 2 — train and reproduce

- Run training in Triangle-controlled infrastructure with restricted access and encrypted storage. The initial implementation is CPU-capable but intentionally tiny; useful training needs substantial authorized data and suitable GPU compute.
- Use only the approved corpus; keep corpus files and resulting checkpoint artifacts out of Git and ordinary CI artifacts.
- Freeze and sign corpus manifests; verify each entry and checksum. The supplied script hashes the input file as provenance metadata; a hash does not prove a right to use the data.
- Reproduce the training run from the recorded commit/config and compare evaluation results. Review for memorized personal or copyrighted text.
- Train instruction behavior/safety only on additional authorized examples. Pretraining alone does not make a helpful assistant.

## Gate 3 — deployment and claims

- Model API exposes only approved artifacts; verify signed artifact hash at release/load. Restrict model host to the regional gateway/private network.
- Keep region assignment, access policy, secrets, logs, backups and any datasets in the approved region. Do not silently fail over.
- Publish an internal model card and public-facing description that accurately states training status, coverage, known limitations, ownership and third-party dependencies.
- Counsel must approve each specific legal wording (“proprietary”, “owned”, “exclusive”, “trained by Triangle”) and any public claim. Ownership depends on facts and applicable law; source code alone cannot guarantee it.
- Preserve notices for Python, PyTorch, FastAPI, Cloudflare and all other dependencies. No upstream model code or weights are included in this scaffold; independently audit repository contents and generated artifacts before asserting that no third-party material is present.

## Implementation status

- [x] New decoder-only byte-level Transformer definition with random initialization.
- [x] Local corpus training prototype and corpus hash in checkpoint metadata.
- [x] Region- and service-token-protected inference prototype.
- [x] Cloudflare Pages Functions JWT and region middleware, with tests (Supabase tokens supported).
- [x] Corpus manifest check: `train.py` refuses to train unless `--manifest` matches the corpus checksum and lists a rights basis for every source.
- [x] Held-out evaluation split (contiguous tail) and eval loss stored in the checkpoint.
- [x] Shared TypeScript SDK and a from-scratch Expo mobile client.
- [x] VPS host definition (Docker, outbound-only Cloudflare Tunnel, no inbound ports).
- [ ] Authorized dataset and rights register.
- [ ] Training run and trained checkpoint.
- [ ] Independent multilingual, safety, privacy and memorization evaluation.
- [ ] Production GPU hosting, artifact-signing, SLOs, security testing and regional audit.
- [ ] Employee/contractor IP paperwork and legal opinion.
- [ ] Approved public proprietary/ownership claim.
