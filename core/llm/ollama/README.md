# Ollama

Helm Scout's private Ollama instance. Isolated from any system Ollama daemon.

## Architectural rule (non-negotiable)

> Helm Scout never touches the system Ollama on port 11434. Helm Scout runs its own Ollama from its own binary, on its own port, against its own models directory. If a foreign process is on Helm Scout's port, Helm Scout refuses to start rather than risk stomping on it.

This is the lesson Core-CE paid for in production. Don't unlearn it.

## The four-variable isolation contract

When Helm Scout spawns Ollama, it pins these env vars:

| Variable | Helm Scout value | Why |
|---|---|---|
| `OLLAMA_HOST` | `127.0.0.1:52450` | Helm Scout's private port. Distinct from 11434. |
| `OLLAMA_MODELS` | `<dataDir>/ollama/models` | Helm Scout's models, not `~/.ollama/models`. |
| `OLLAMA_ORIGINS` | `*` | Daemon is loopback-bound; wildcard is fine. |
| `CUDA_VISIBLE_DEVICES` | (UUID from headless-first selector) | Pins inference to the right GPU. |

These four together make Helm Scout's Ollama and the system's Ollama completely invisible to each other.

## Files

- `env.ts` — the isolation env builder. Single source of truth for the contract.
- `process-utils.ts` — `lsof`-based PID lookup + the "is this PID actually ours?" check (matches command line against Helm Scout's binary path).
- `manager.ts` — start/stop/status. Registers the process with BMOC. Refuses to start if a foreign process holds the port.
- `chat.ts` — (forthcoming, branch 2) HTTP client for `/api/chat`.

## Customer of BMOC

The Ollama PID is registered with BMOC on spawn and unregistered on stop. `bmoc.closeAllSessions()` kills Ollama as a side effect. This is the first real customer of the BMOC authority we wired up earlier.
