# Local tools for building and checking chapters. Run from the repository root; `make` lists the commands.
# Extra flags go in ARGS, e.g.  make smoke PAGE=books/clrs/ch01.html ARGS="--dark --only=3"

PY := uv run --project tools python
KOKORO_URL := https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
MODELS := tools/video/models

need = $(if $($(1)),,$(error $(1) is required, e.g. make $@ $(1)=$(2)))

.DEFAULT_GOAL := help
.PHONY: help setup models extract site audit factcheck rustcheck smoke play steps rustview interact narrate metrics record scenes series video-plan video-trace video-silent video-part video-long video-qa

help: ## List the commands
	@awk 'BEGIN {FS = ":.*## "} /^[a-z-]+:.*## / {printf "  %-11s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# --- setup
setup: ## Install the Python (uv) and node dependencies
	cd tools && npm install --no-audit --no-fund
	uv sync --project tools

models: ## Download Kokoro's weights into tools/video/models/ (resumes if interrupted)
	mkdir -p $(MODELS)
	curl -fL -C - --retry 5 -o $(MODELS)/kokoro-v1.0.onnx $(KOKORO_URL)/kokoro-v1.0.onnx
	curl -fL -C - --retry 5 -o $(MODELS)/voices-v1.0.bin $(KOKORO_URL)/voices-v1.0.bin

# --- authoring
extract: ## Extract book text: PDF=books/ddia/DDIA.pdf ARGS="ddia 11" (or ARGS=--list)
	$(call need,PDF,books/ddia/DDIA.pdf)
	$(PY) tools/authoring/extract.py $(PDF) $(ARGS)

# --- static checks, no browser
site: ## Parse every page and check its links, as the deploy does
	node tools/static/check-site.js

audit: ## Check a page's structure: PAGE=books/ddia/ch11.html
	$(call need,PAGE,books/ddia/ch11.html)
	python3 tools/static/audit.py $(PAGE) $(ARGS)

factcheck: ## Check a chapter's claims against the book: BOOK=ddia CH=11
	$(call need,BOOK,ddia)
	$(call need,CH,11)
	python3 tools/static/factcheck.py $(BOOK) $(CH) $(ARGS)

rustcheck: ## Compile and run a page's Rust listings: PAGE=books/clrs/ch01.html
	$(call need,PAGE,books/clrs/ch01.html)
	python3 tools/static/rustcheck.py $(PAGE) $(ARGS)

# --- browser checks, headless Chrome
smoke: ## Click every control in every simulation: PAGE=… ARGS=--light
	$(call need,PAGE,books/ddia/ch11.html)
	node tools/browser/smoke.js $(PAGE) $(ARGS)

play: ## Press each simulation's main button and screenshot it: PAGE=… ARGS=--light
	$(call need,PAGE,books/ddia/ch11.html)
	node tools/browser/play.js $(PAGE) $(ARGS)

steps: ## Visit every step of every CLRS machine: PAGE=… ARGS=--light
	$(call need,PAGE,books/clrs/ch27.html)
	node tools/browser/steps.js $(PAGE) $(ARGS)

rustview: ## Report steps where the Rust listing lights up nothing: PAGE=…
	$(call need,PAGE,books/clrs/ch27.html)
	node tools/browser/rustview.js $(PAGE) $(ARGS)

interact: ## Use each machine as a reader would: PAGE=…
	$(call need,PAGE,books/clrs/ch27.html)
	node tools/browser/interact.js $(PAGE) $(ARGS)

# --- video
narrate: ## Turn a video script into timed narration: SCRIPT=videos/clrs/ch01/script.md
	$(call need,SCRIPT,videos/clrs/ch01/script.md)
	$(PY) tools/video/narrate.py $(SCRIPT) $(ARGS)

metrics: ## Report a voice's pitch and pauses: WAV="a.wav b.wav"
	$(call need,WAV,a.wav)
	$(PY) tools/video/voice_metrics.py $(WAV)

record: ## Record one narrated scene: SCENE=videos/scripts/<scene>.json OUT=videos/<scene>.mp4
	$(call need,SCENE,videos/scripts/<scene>.json)
	node tools/video/record.js $(SCENE) $(OUT)

scenes: ## Record every chapter-1 scene into videos/
	tools/video/make-all.sh

series: ## Record each numbered video in a folder (N-name/script.md), in order: ONLY=<book>/<folder> (or one video)
	tools/video/make-series.sh "$(VOICE)" "$(ONLY)"

# --- chapter videos, in the order of the write-video-script, record-video and publish-video skills (.claude/skills/)
video-plan: ## Step 1: list what a chapter page's machines offer: PAGE=books/clrs/ch02.html
	$(call need,PAGE,books/clrs/ch02.html)
	$(PY) tools/video/plan.py $(PAGE)

video-trace: ## Steps 1 and 4: print a machine's pseudocode and what each Step lights: PAGE=books/clrs/ch02.html SCENE=merge ARGS="Reset"
	$(call need,PAGE,books/clrs/ch02.html)
	$(call need,SCENE,merge)
	node tools/video/trace.js $(PAGE) $(SCENE) $(ARGS)

video-silent: ## Step 6: record the whole script without a voice, to check cues and claims fast: SCRIPT=videos/clrs/ch02/script.md
	$(call need,SCRIPT,videos/clrs/ch02/script.md)
	node tools/video/studio.js $$($(PY) tools/video/narrate.py $(SCRIPT) --silent | sed -n 's/.*→ //p')

video-part: ## Step 7: narrate and record one part: SCRIPT=videos/clrs/ch02/script.md ONLY="Part 1" (VOICE optional)
	$(call need,SCRIPT,videos/clrs/ch02/script.md)
	$(call need,ONLY,Part 1)
	node tools/video/studio.js $$($(PY) tools/video/narrate.py $(SCRIPT) --only "$(ONLY)" --voice $(or $(VOICE),kokoro:bm_fable) | sed -n 's/.*→ //p')

video-long: ## Step 8: narrate a long form, record only the parts that changed, join them: SCRIPT=… (VOICE, ARGS="--page-scenes=big-o" optional)
	$(call need,SCRIPT,videos/clrs/ch03/script.md)
	node tools/video/assemble.js $$($(PY) tools/video/narrate.py $(SCRIPT) --voice $(or $(VOICE),kokoro:bm_fable) | sed -n 's/.*→ //p') $(ARGS)

video-qa: ## Step 8: measure a finished video against the quality bar for its kind: VIDEO=videos/clrs/ch01/ch01-the-role-of-algorithms-in-computing.mp4
	$(call need,VIDEO,videos/clrs/ch01/ch01-the-role-of-algorithms-in-computing.mp4)
	$(PY) tools/video/qa.py $(VIDEO)
