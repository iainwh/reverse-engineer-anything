---
name: reverse-engineer-anything
description: Reverse engineer native, managed, Electron/JavaScript, packaged, firmware, and browser targets with REA. Use shipped-artifact or requested runtime evidence to explain features, compare versions, decompile code, or guide a reconstruction. Skip REA for ordinary source-repository architecture analysis.
metadata:
  version: "42"
---

# REA

Use REA when a claim depends on a shipped binary or package, decompilation,
passive application runtime evidence, or comparison with
behavior not established by available source. For ordinary analysis of a
complete source repository, use normal repository tools and do not run REA
readiness or provider commands.

## Connect only when needed

Installing this skill supplies instructions; it does not register the REA MCP
server, install analysis engines, or add tools to an already-running agent.

If REA tools are available and their registration is not known to be stale,
proceed directly to the target. Do not run diagnostics or setup before every
investigation. Use the connected server's actual tool list and input schemas;
a skill installed from repository main may describe capabilities absent from
an older npm release. Keep complete inline Evidence when that server does not
advertise retained references.

If tools are absent, a call is blocked by the client, or a required provider is
unavailable, read [connection and recovery](references/connection-and-recovery.md).
Diagnose the observed blocker, continue useful supported work, and resume the
original task after repair. Client approval, shell PATH, registration and engine
availability have different remedies; avoid repeating setup for all of them.

Prefer an existing `rea` CLI. When none is installed and acquiring the package
is authorized, use `npx -y rea-agents@latest` in its place. A JavaScript tree
or ASAR can be inspected without MCP:

```bash
npx -y rea-agents@latest analyze-javascript-application /absolute/path/to/app --json
```

That command returns the Evidence record directly. It does not establish that
MCP is configured. Native CLI tasks still require their selected engine.
Setup never installs or upgrades Node.js, npm, Homebrew, Java, Ghidra, IDA,
JADX, Kuna, Binwalk, or Unblob.

## Route the target first

Choose the first tool from the target the user supplied. Use `open_binary` for
active-target native or archive workflows. Target-free tools take their own
explicit path or endpoint.

- ASAR or extracted JavaScript/Electron tree: `analyze_javascript_application`.
- Archive or package member inventory: `open_binary`, then `inspect_artifact`
  when its graph helps.
- Android APK code: `inspect_android_package`.
- Managed PE/CLI assembly: `inspect_managed_artifact`.
- Firmware image: `inspect_firmware_regions`, or `extract_firmware` when
  extraction is requested.
- Native executable, library, or analysis database: `open_binary`, then
  focused analysis. Call `binary_overview` when the selected provider offers it.

Packet, signal, WebAssembly, EVM, Go, Rust, SQLite, ELF layout, crash, PE
resource, IDA, and Kuna routes are in
[target routing](references/target-routing.md).

If the user says only "my app" without a name, path, or target already selected
for this task, ask which app before searching for artifacts. Paths in unrelated
saved reports and nearby test fixtures do not select the user's target. Resolve
an actual human-readable app name to one clear installed artifact when possible;
ask when matches are ambiguous. Never choose an example app on the user's behalf.

In a target-free session, use `open_binary` to bind any archive/package or
native target whose analysis tool operates on the active target. Do not call an
unadvertised tool. Inspect `binary_session` with `{}` and follow
[target routing](references/target-routing.md) for availability, provider
candidates, and session capabilities.

## Work summary-first

Start with the default result and use its inline Evidence and graph context.
For a JavaScript application or ELF layout whose size is unknown or large,
call `analyze_javascript_application` or `inspect_binary_layout` with
`"detail": "summary"`, then inspect the retained `parent_evidence_id` with
`inspect_analysis_view`. Do not repeat an identical analysis or rejected call
without a changed input or resolved blocker.

Every conclusion must distinguish observations, inferences, and unknowns. Cite
Evidence IDs, preserve limitations and incomplete coverage, and never imply
that static analysis observed execution. Runtime requests execute the declared
target and lifecycle; do not broaden the target or action beyond those fields.

Within the user's requested investigation, call available analysis tools
directly. REA does not require permission grants or per-call approval flags.
The agent client can independently require approval. Follow the declared request
scope and the host's actual access requirements; use the recovery guide for an
observed client-policy rejection.

Paging, transport limits, truncated previews, and exported bundles are in
[evidence workflows](references/evidence-workflows.md).

## Plan broader investigations

For requests that span multiple features or subsystems, follow
[investigation planning](references/investigation-plan.md). Keep a concise
finding ledger linking each conclusion to Evidence IDs. Do not describe a
broad investigation as complete while required questions remain open.

## Read only the relevant guide

- Choosing the first tool, including specialized formats and providers:
  [references/target-routing.md](references/target-routing.md)
- Native binaries, managed assemblies, archives, and extraction:
  [references/native-and-artifacts.md](references/native-and-artifacts.md)
- ASARs, extracted JavaScript, feature tracing, and version comparison:
  [references/javascript-applications.md](references/javascript-applications.md)
- Android APK declarations, classes, methods, and static references:
  [references/android-applications.md](references/android-applications.md)
- Browser/Electron observation (passive and scenario) and static/runtime
  reconciliation:
  [references/runtime-observation.md](references/runtime-observation.md)
- Evidence paging, comparisons, residual unknowns, and verification:
  [references/evidence-workflows.md](references/evidence-workflows.md)
- Multi-feature checklists and finding ledgers:
  [references/investigation-plan.md](references/investigation-plan.md)

## Finish the task

Explain findings in plain language and tie them to returned evidence. When the
user asks to build something, use normal coding tools and separate observed
behavior from design choices. Close an opened native session with
`close_binary` when the investigation is complete.
