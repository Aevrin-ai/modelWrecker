"""Shared fakes for the cloud sync tests: a scripted control-plane API, a fake clock, run folders.

Everything is offline: HTTP goes through httpx.MockTransport. `make_run` plants SECRET in every
place of a run folder that a metadata-only sync must never read, so a privacy test can prove the
sync body carries none of it.
"""

from __future__ import annotations

import json
from pathlib import Path

import httpx

from modelwrecker.cloud import (
    CloudClient,
    DeviceCode,
    DeviceCredential,
    SyncPolicy,
    save_credential,
)
from modelwrecker.data import (
    Confidence,
    Evidence,
    Finding,
    Objective,
    Outcome,
    ReliabilityResult,
    Severity,
    TaxonomyRef,
    ToolCall,
    Verdict,
)
from modelwrecker.storage.store import RunStore

API = "https://cloud.test/api/v1"
TOKEN = "mwd_" + "T0kenValueForTestsOnly_abcdefghijklmnop"
SECRET = "PLANTED-7f3a9c"
RUN_ID = "20261002-020850-e4a5e2ae"
EVIDENCE_ON = SyncPolicy(evidence=True)
TRANSCRIPTS_ON = SyncPolicy(transcripts=True)
BOTH_ON = SyncPolicy(evidence=True, transcripts=True)


class FakeClock:
    def __init__(self) -> None:
        self.t = 0.0
        self.sleeps: list[float] = []

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.t += seconds

    def now(self) -> float:
        return self.t


class Api:
    """A scripted fake of the control-plane API. Records every request."""

    def __init__(self, token_replies: tuple | list = (), sync_replies: tuple | list = (),
                 heartbeat: tuple[int, dict] = (200, {"ok": True})) -> None:
        self.token_replies = list(token_replies)
        self.sync_replies = list(sync_replies)
        self.heartbeat = heartbeat
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        path = request.url.path
        if path.endswith("/device/code"):
            return httpx.Response(200, json={
                "device_code": "dc-" + "x" * 40, "user_code": "WDJB-MJHT",
                "verification_uri": "https://cloud.test/dashboard/connect",
                "verification_uri_complete": "https://cloud.test/dashboard/connect?code=WDJB-MJHT",
                "expires_in": 900, "interval": 5,
            })
        if path.endswith("/device/token"):
            status, body = self.token_replies.pop(0)
            return httpx.Response(status, json=body)
        if path.endswith("/device/heartbeat"):
            return httpx.Response(self.heartbeat[0], json=self.heartbeat[1])
        if path.endswith("/sync"):
            reply = self.sync_replies.pop(0) if self.sync_replies else (200, ok_reply())
            if isinstance(reply, Exception):
                raise reply
            return httpx.Response(reply[0], json=reply[1])
        return httpx.Response(404, json={"error": "not_found"})

    def paths(self) -> list[str]:
        return [r.url.path for r in self.requests]

    def sync_bodies(self) -> list[dict]:
        return [json.loads(r.content) for r in self.requests if r.url.path.endswith("/sync")]


def ok_reply(**extra: object) -> dict:
    return {"ok": True, "campaign_id": "c-uuid", "run_id": "r-uuid", "findings": 1, **extra}


def detail_reply(evidence: bool, transcripts: bool) -> tuple[int, dict]:
    """A sync reply that says which detail the server kept."""
    return 200, ok_reply(detail={"evidence": evidence, "transcripts": transcripts})


def pending_reply() -> tuple[int, dict]:
    return 400, {"error": "authorization_pending"}


def granted_reply() -> tuple[int, dict]:
    return 200, {"device_token": TOKEN, "device_id": "dev-uuid", "project_id": "proj-uuid"}


def client_for(api: Api, token: str | None = None) -> CloudClient:
    return CloudClient(API, token, transport=httpx.MockTransport(api))


def fake_device_code(expires_in: int = 900, interval: int = 5) -> DeviceCode:
    return DeviceCode("dc", "WDJB-MJHT", "https://x/c", "https://x/c?code=WDJB-MJHT",
                      expires_in, interval)


def login_file(api_url: str = API) -> None:
    save_credential(DeviceCredential(token=TOKEN, device_id="d1", api_url=api_url))


def make_run(base: Path, run_id: str = RUN_ID, project: str | None = "local-smoke-test",
             finding_strategy: str | None = "crescendo") -> Path:
    """A realistic run folder with a secret planted in every place the sync must never read."""
    store = RunStore(run_id=run_id, base_dir=base)
    store.event("run_meta", target_model="llama3", target_provider="openai_compatible",
                run_id=run_id, target_type="chat", project_name=project)
    objective = Objective(title="Extract the target's hidden system prompt",
                          category="system_prompt_leak",
                          description=f"{SECRET}-objective-description",
                          success_criteria=f"{SECRET}-success-criteria")
    for strategy, outcome in (("crescendo", "success"), ("crescendo", "partial"),
                              ("crescendo", "refused"), ("direct_jailbreak", "refused")):
        store.event("attempt", objective=objective.title, strategy=strategy,
                    payload=f"{SECRET}-event-payload", response=f"{SECRET}-event-response",
                    outcome=outcome, score=9 if outcome == "success" else 1,
                    category=objective.category)
    evidence = _planted_evidence(objective)
    finding = Finding(
        objective_id=objective.id, attempt_id="a1", severity=Severity.CRITICAL,
        title=objective.title, summary=f"{SECRET}-finding-summary",
        taxonomy=[TaxonomyRef(framework="owasp_llm", id="LLM07", edition="2025",
                              title="System Prompt Leakage")],
        evidence_id=evidence.id, run_id=run_id,
    )
    evidence.finding_id = finding.id
    store.save_evidence(evidence)
    store.save_finding(finding)
    extra = {"strategy": finding_strategy} if finding_strategy else {}
    store.event("finding", id=finding.id, severity="critical", title=finding.title, **extra)
    return store.dir


def _planted_evidence(objective: Objective) -> Evidence:
    return Evidence(
        target={"model": "llama3", "base_url": f"https://{SECRET}-base-url.example/v1"},
        objective=objective,
        strategy="eb3934ceb9624ce29c033e76d0f28047",  # the engine stores the plan id here
        strategy_params={"hint": f"{SECRET}-strategy-params"},
        payload=f"{SECRET}-evidence-payload",
        target_response=f"{SECRET}-evidence-response",
        target_reasoning=f"{SECRET}-reasoning",
        tool_calls=[ToolCall(name="shell", args={"cmd": f"{SECRET}-tool-args"})],
        judge_result=Verdict(observation_id="o1", outcome=Outcome.SUCCESS, score=9,
                             rationale=f"{SECRET}-judge-rationale"),
        reliability=ReliabilityResult(attempt_id="a1", attempts_run=20, successes=17,
                                      success_rate=0.85, ci_low=0.6396, ci_high=0.9476,
                                      confidence=Confidence.RELIABLE),
        model={"model": "llama3", "provider": "openai_compatible"},
        provider={"base_url": f"https://{SECRET}-provider-url.example"},
        configuration={"target": {"base_url": f"https://{SECRET}-config-url.example/v1",
                                  "system": f"{SECRET}-system-prompt",
                                  "api_key_env": "OPENROUTER_API_KEY"}},
        attack_sequence=[{"role": "user", "content": f"{SECRET}-attack-sequence"}],
        reproduction_steps=f"{SECRET}-repro-steps",
    )


def assert_private(body: dict) -> None:
    text = json.dumps(body)
    assert SECRET not in text, "the sync body leaked content from the run folder"
    for banned in ("payload", "response", "reasoning", "system", "base_url", "api_key",
                   "tool_calls", "args", "attack_sequence", "reproduction", "summary", "rationale"):
        assert f'"{banned}' not in text, f"the sync body has a forbidden field: {banned}"
