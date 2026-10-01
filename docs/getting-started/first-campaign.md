# Your first campaign

A start-to-finish walkthrough. It uses only commands that have been tested. For authorized testing only:
attack models you own or have written permission to test.

## 1. Install

```bash
pip install .            # from the repo, in a fresh virtual environment
modelwrecker --help
```

(During development you can also run it as `python -m modelwrecker.cli` with `PYTHONPATH=src`.)

## 2. Set your API key

modelWrecker reads the key from an environment variable; it never goes in the YAML file.

```bash
export OPENROUTER_API_KEY=sk-or-...        # macOS/Linux
# PowerShell:  $env:OPENROUTER_API_KEY = "sk-or-..."
```

Fully local and free? Run Ollama instead (`ollama run llama3`) and use `examples/local-model.yaml` - no
key needed.

## 3. Create a config

```bash
modelwrecker init my-first-test.yaml
```

This writes a starter file. Open it and set your `model` and, if testing a chatbot you built, the
target's `system` prompt. Make sure the target has `authorized: true`.

## 4. Validate it

```bash
modelwrecker validate my-first-test.yaml
```

You should see `valid and ready to run`. If not, it tells you exactly what to fix.

## 5. Check the connection (optional but recommended)

```bash
modelwrecker provider test my-first-test.yaml --role target
```

This sends one small request and prints latency and token usage. `PASS` means you are connected.

## 6. Run the campaign

```bash
modelwrecker run my-first-test.yaml
```

You will see progress lines, then a report. Artifacts are saved to `runs/<run-id>/`.

## 7. Read the output

A finding looks like this:

```text
## CRITICAL - Extract the target's hidden system prompt
- taxonomy: owasp_llm:LLM07 (System Prompt Leakage), mitre_atlas:AML.T0057 (LLM Data Leakage)
success (score 9/10), 5/5 replays [reliable]. judge: secret leaked
```

- **severity** - how serious, based on the judge score and how reliably it reproduced.
- **taxonomy** - the standard security categories it maps to.
- **replays** - how many of the re-runs also succeeded. `reliable` means it is not a fluke.

No findings? That means the target held up. That is a valid, useful result.

## 8. Inspect the evidence

```bash
ls runs/<run-id>/
# events.jsonl   evidence-*.json   finding-*.json   index.sqlite   report.md
```

The `evidence-*.json` file has the exact payload, the target's response, the judge verdict, and the
reliability numbers - everything needed to reproduce the finding.

## 9. Re-render the report later

```bash
modelwrecker report runs/<run-id>
```

## Choosing an attack

- Let modelWrecker choose: `attack: { strategy: auto }`.
- Force one: `attack: { strategy: prompt_extraction }`. List them with `modelwrecker strategies`.

The attacker/planner chooses the strategy - never the provider. That separation is on purpose.
