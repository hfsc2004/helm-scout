# Firmware flash

Compile + upload sketches to microcontrollers using Helm Scout's private arduino-cli.

## What's here

- `templates.ts` — load sketch templates from `<repo>/firmware/templates/<id>/`
- `render.ts` — validate user-supplied vars against the manifest, substitute `{{placeholders}}`, derive `.octets` for IPv4 strings and explicit `.cpp` escaped C++ string contents
- `flash.ts` — the lifecycle: render → resolve arduino-cli → ensure core installed → compile → upload, with NDJSON-shaped progress events
- `upload-args.ts` — upload arguments and ESP32 full-flash erase recipe property
- `index.ts` — typed surface

## Templates

Each template is a directory under `firmware/templates/<id>/`:

```
ground-skidsteer-esp32/
  template.json     id, name, target, fqbn, core, vars[]
  sketch.ino        the source, with {{var.key}} placeholders
```

`vars[]` declares typed inputs. `string`, `secret`, `number`, `boolean`. Missing required vars or wrong types fail loudly — no silent coercion.
`sketchFiles[]` optionally lists header files beside `sketch.ino`; Helm Scout copies
them into the staged Arduino sketch directory before compiling. Names must be
plain filenames, not paths. The Sensor Board v1.3 template uses this for its
boot-chime PCM and bench API/configuration headers.
If a template has a `src/` directory, Helm Scout also copies that tree into the
staged sketch. Arduino compiles source files recursively beneath `src/`; the
Sensor Board v1.3 template uses this for its bundled VL53L1CB driver.

## BMOC integration

The arduino-cli compile and upload subprocesses each register with BMOC. Window-close or app-quit mid-flash kills them cleanly.

## What's next (not in this branch)

- Pico/Pico 2 flashing via mpremote (separate template kind; uses `core/toolchains/mpremote/`)
- Devices-tab UI to pick a template + fill vars + watch progress (B3)

## Erase before Flash

For `esp32:esp32:*` boards, erase uses `--upload-property upload.erase_cmd=-e`.
Arduino CLI upload has no `--erase` flag. Other platforms are rejected when
erasure is requested. Erasing clears the entire flash, including saved settings.

## Bench firmware validation

Run the template/render tests with
`node --import tsx --test core/firmware-flash/bench-template.test.ts`.
The platform-independent saved-config, input-validation, and mounting-axis tests
can be compiled with
`g++ -std=c++17 -Wall -Wextra -Werror core/firmware-flash/tests/bench-config.cpp -o /tmp/helm-bench-config-test`
and run as `/tmp/helm-bench-config-test`.

`{{key.cpp}}` explicitly escapes string contents for a quoted C++ literal,
including quotes, backslashes, and control characters. Existing `{{key}}` raw
substitutions retain their prior behavior. The v1.3 OTA password uses this variant.

The SR Front ToF stop/sleep acknowledgement tests run with
`g++ -std=c++17 -Wall -Wextra -Werror core/firmware-flash/tests/wide-tof-control.cpp -o /tmp/helm-wide-tof-test`
then `/tmp/helm-wide-tof-test`.
Wi-Fi failover tests use
`g++ -std=c++17 -Wall -Wextra -Werror -Icore/firmware-flash/tests/wifi-failover core/firmware-flash/tests/wifi-failover.cpp -o /tmp/helm-wifi-test`
then `/tmp/helm-wifi-test`.
