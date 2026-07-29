---
description: Micro-benchmark session snapshot load (cold vs warm cache)
---

# Bench

```bash
grok-hud bench
grok-hud bench 50
```

Times `loadSnapshotFromDir`:

- **cold** — caches cleared, full parse  
- **warm** — mtime/git caches allowed (should be much faster when idle)

Local only; no network. Use after upgrades to sanity-check 1.3–1.5 caches.
