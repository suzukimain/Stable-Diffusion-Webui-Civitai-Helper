# Copilot instructions for this repo

This repo is an extension for AUTOMATIC1111 Stable Diffusion WebUI. It runs inside WebUI’s Python/Gradio process. Develop by placing this folder under `stable-diffusion-webui/extensions` and restarting WebUI (Reload UI is not enough).

## Big picture
- Entry point: `scripts/civitai_helper.py`
  - Registers settings (`on_ui_settings`) and tabs (`on_ui_tabs`).
  - Builds the main tab via `ch_lib/sections.py` and optional browser tab via `browser/browser.py`.
  - Declares hidden Gradio widgets used as a JS ⇄ Python bridge.
- Core logic (`ch_lib/`):
  - `util.py` (logging, opts, versioning, proxies, hashing helpers, HTML sanitize/trim).
  - `civitai.py` (API URLs, type maps, NSFW levels, API fetch, model/version info loaders).
  - `downloader.py` (requests with retries/backoff, resumable downloads via `.downloading`, Gradio-friendly progress strings).
  - `model.py` (extra-network folders, info file paths, read/write, organize models, safety checks).
  - `model_action_civitai.py` (scan, fetch-by-URL, check/download new versions, skeleton metadata when not on Civitai).
  - `js_action_civitai.py` (bridge handlers: open URL, trigger words, preview prompt, rename/remove, download new version).
- Browser UI: `browser/` renders search + cards; `supported_models.py` enumerates base models.
- Frontend JS: `javascript/civitai_helper.js` augments Extra Networks and drives the bridge; `javascript/autocomplete.js` works with `scripts/autocomplete.py` FastAPI endpoints.

## Files written next to models
- `[model].civitai.info` (Civitai metadata) and `[model].json` (WebUI metadata editor).
- Overwrite rules: guarded by `util.create_extension_block` + `COMPAT_VERSION_*`; use `model.metadata_needed*` before writing.

## JS ⇄ Python bridge (how to extend)
- Hidden components defined in `scripts/civitai_helper.py`:
  - Textboxes: `#ch_js_msg_txtbox` (JS→Py), `#ch_py_msg_txtbox` (Py→JS)
  - Hidden Buttons: `#ch_js_open_url_btn`, `#ch_js_add_trigger_words_btn`, `#ch_js_use_preview_prompt_btn`, `#ch_js_rename_card_btn`, `#ch_js_remove_card_btn` (others are created in sections when needed)
- JS (`javascript/civitai_helper.js`):
  - Build `{ action, model_type, search_term, prompt, neg_prompt, new_name }`.
  - Write JSON into `#ch_js_msg_txtbox`, dispatch `input`, click hidden button, poll `#ch_py_msg_txtbox`.
- Python (`ch_lib/js_action_civitai.py`): parse via `msg_handler.parse_js_msg`, perform action, optionally respond with `msg_handler.build_py_msg`.
- To add an action: add a hidden Button in `scripts/civitai_helper.py`, wire `.click(...)` to a new handler, and add a JS function that sends/receives on the bridge.

## HTTP, hashing, options
- HTTP: use `downloader.request_get` (default headers, proxies, retries/backoff). For Civitai JSON, prefer `civitai.civitai_get`.
- Auth: if `opts["ch_civiai_api_key"]` is set, add `Authorization: Bearer …` when downloading.
- Proxies: `opts["ch_proxy"]` updates `util.PROXIES` at runtime (`update_proxy`).
- Hashing: `util.gen_file_sha256` uses WebUI’s cache (`modules.cache`/`modules.hashes`), respects `--no-hashing`, supports AutoV3 when `opts["ch_autov3"]` is true.

## Gradio compatibility
- Some UI code branches on `util.GRADIO_FALLBACK` (older Gradio). In fallback, return `component.update(...)`; otherwise return new component instances. Preserve both paths where present (see `ch_lib/sections.py`, `browser/browser.py`).

## Typical workflows to test
- Scan models: `model_action_civitai.scan_model` → hash → fetch → write info → download previews (delay to avoid hammering API).
- Get model info by URL: parse ID, resolve model path, fetch version info, write files, fetch preview.
- Check new versions: `model_action_civitai.check_models_new_version_to_md` builds HTML with download links calling `window.ch_dl_model_new_version(...)` back into Python.
- Browser search: `browser/browser.py` builds query params and fetches `/models?`, paginates via `meta.nextPage`.

## Conventions
- Logging: `util.printD` for console; `gr.Info/Warning/Error` for user-visible notices.
- HTML: sanitize with `util.safe_html` or strip via `util.trim_html` before injecting.
- Windows paths in HTML/JS must escape backslashes (see `ch_lib/templates.py`).
- PRs: target development branches (see README “Branches”); keep WebUI compatibility or guard changes by version.

If anything here is unclear (e.g., bridge wiring, WebUI API boundaries, Gradio fallback), call it out in your PR/commit so we can refine this guide.