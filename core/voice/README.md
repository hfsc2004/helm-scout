# Voice

Optional STT/TTS subsystem for Helm Scout.

## Design rules

- Voice is **optional**. The "not installed" state is fully supported — the rest of Helm Scout never breaks when voice is absent.
- All voice files live under one directory (`<dataDir>/voice/`). Uninstall is "stop processes + delete folder."
- Engines: **whisper.cpp** for STT, **piper** for TTS. Both are single-binary, no Python.
- Binaries and default models are fetched from Helm Scout's own GitHub releases (one outbound destination, declared in the privacy canary).
- Storage is capped (`STORAGE_LIMITS.voiceAssetsBytes`, default 2 GB).
- Speech audio is never transmitted; transcription happens locally and the audio is discarded after the command runs.

## v0.1 status

- Types + state + paths + uninstall: scaffolded.
- Install (fetcher): stubbed — lands in v0.2 when real binaries are wired up.
