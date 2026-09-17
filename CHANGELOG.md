# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Switch top-level pipeline run span kind from `INTERNAL` to `SERVER`, according to
  OTel semconv: https://opentelemetry.io/docs/specs/semconv/cicd/cicd-spans/#pipeline-run

## [4.1.1] - 2026-08-14

### Changed

- CICD: skip the sourcemap when diffing dist. Streaming its diff to the job log dominated
  the Validate dist step, pushing the build job to nearly ten minutes on a stale-bundle failure.
- Build: rebuild dist for undici 6.28.0. Dependabot only updates package-lock.json,
  but undici is a runtime dependency that rollup inlines into the committed bundle.
- Editorial: Use Dash0 endpoints in README examples.

## [4.1.0] - 2026-07-27

### Added

- Added the `otlpInsecureSkipVerify` input for exporting to trusted internal OTLP endpoints whose
  TLS certificates cannot be verified.
  Thanks @OneCyrus!

### Changed

- Span status now follows the OpenTelemetry
  [recording-errors](https://opentelemetry.io/docs/specs/semconv/general/recording-errors/)
  conventions: it is set to `Error` (with the standard `error.type` attribute) for the
  `failure`, `timed_out`, and `startup_failure` conclusions, and left unset otherwise
  (previously it was set to `Ok` on success and `Error` only for `failure`).
- **Removed** the non-standard boolean `error` attribute from workflow, job, and step spans.
  Use the span status or the `error.type` attribute instead.
- The `github.job.labels` attribute is now exported as an array of strings instead of a
  comma-separated string, consistent with the PR label attributes.

- The repository was transferred from `corentinmusard/otel-cicd-action` to
  [`dash0hq/otel-cicd-action`](https://github.com/dash0hq/otel-cicd-action) and is now maintained
  by [Dash0](https://www.dash0.com). Existing `uses: corentinmusard/otel-cicd-action@v4` references
  keep working via GitHub's redirect, but updating to `dash0hq/otel-cicd-action@v4` is recommended.

## [4.0.1] - 2026-03-18

### Fixed

- Updated dependencies

## [4.0.0] - 2026-02-07

### ⚠ BREAKING CHANGES

Upgraded action from node20 to node24.

> Make sure your runner is on version v2.327.1 or later to ensure compatibility with this release. [See Release Notes](https://github.com/actions/runner/releases/tag/v2.327.1)

## [3.0.0] - 2026-01-30

### ⚠ BREAKING CHANGES

- Upgraded OpenTelemetry JS SDK to [v2](https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/upgrade-to-2.x.md)
- The parentSpanId field on the Span and ReadableSpan interfaces was replaced by parentSpanContext, to adhere to the OTel spec: `span.parentSpanId` -> `span.parentSpanContext?.spanId`

### Added

Added missing [semconv attributes](https://opentelemetry.io/docs/specs/semconv/registry/attributes/cicd/):

- `cicd.pipeline.action.name`
- `cicd.pipeline.task.run.url.full`
- `cicd.pipeline.result`
- `cicd.pipeline.run.state`
- `cicd.pipeline.task.run.result`
- `cicd.worker.id`
- `cicd.worker.name`

### Fixed

- Updated dependencies

## [2.2.4] - 2025-08-07

### Fixed

- Include cancelled steps in trace

## [2.2.3] - 2025-01-30

### Fixed

- Update dependencies

## [2.2.2] - 2025-01-17

### Fixed

- Add extraAttributes to action definition

## [2.2.1] - 2025-01-06

### Fixed

- `pull-requests: read` permission is now optional. If not set, PRs labels will not be added to the trace

## [2.2.0] - 2025-01-05

### Added

- Add job annotations if available, requires the following permission on private repositories:

```yaml
permissions:
  checks: read # Optional. To read run annotations
```

### Fixed

- Add error handling for octokit requests

## [2.1.0] - 2025-01-05

### Added

- Add `extraAttributes` input to add arbitrary resource attributes

## [2.0.0] - 2025-01-04

### ⚠ BREAKING CHANGES

- Removed compatibility with [inception-health/otel-upload-test-artifact-action](https://github.com/inception-health/otel-upload-test-artifact-action) action. It is based on `@actions/artifact` prior to `v2` which is deprecated since June 2024 and will be removed in [January 30th, 2025](https://github.blog/changelog/2024-04-16-deprecation-notice-v3-of-the-artifact-actions/). If you were using this action, please open an issue to discuss your use case.
- Removed `github.author_name` attribute, use `github.head_commit.author.name` instead
- Removed `github.author_email` attribute, use `github.head_commit.author.email` instead

### Changed

- Changed licence under my name (still MIT)

## [1.13.2] - 2025-01-04

### Fixed

- Fix artifacts parsing for `@opentelemetry/exporter-trace-otlp-http` version `<0.29.0`

### Changed

- Refactor artifacts handling

## [1.13.1] - 2024-12-31

### Fixed

- Fix type error

## [1.13.0] - 2024-12-31

### Added

- Add attributes on the workflow span:
  - `github.referenced_workflows`
  - `github.url`
  - `github.status`
  - `github.node_id`
  - `github.check_suite_id`
  - `github.check_suite_node_id`
  - `github.jobs_url`
  - `github.logs_url`
  - `github.check_suite_url`
  - `github.artifacts_url`
  - `github.cancel_url`
  - `github.rerun_url`
  - `github.head_branch`
  - `github.path`
  - `github.display_title`
- Add attributes on the job spans:
  - `github.job.run_url`
  - `github.job.node_id`
  - `github.job.head_sha`
  - `github.job.url`
  - `github.job.html_url`
  - `github.job.status`
  - `github.job.runner_id`
  - `github.job.created_at`
  - `github.job.check_run_url`
  - `github.job.workflow_name`
  - `github.job.head_branch`

### Fixed

- Return the correct value for `github.head_commit.author.name` and `github.head_commit.committer.name`

## [1.12.1] - 2024-12-31

### Fixed

- Fix rollup build by setting transformMixedEsModules to true

### Changed

- Use global context propagation instead of passing it around

## [1.12.0] - 2024-12-30

### Added

- Add step.status field

### Changed

- Remove trace.ts dependency on github.ts
- Simplify paginated octokit queries
- Use global tracer instead of passing it around
- tests: Add a replay client
- Migrate to ESM
- Migrate from ncc to rollup
- Migrate from eslint/prettier to biome

## [1.11.0] - 2024-12-19

### Added

- Add support for `http` endpoints

### Changed

- Update dependencies

## [1.10.0] - 2024-11-08

### Added

- Update otel dependencies to latest
- Add example for configuration with Dash0
- Add OpenTelemetry CICD Pipeline Attributes
- Add labels from a PR to the trace span

## [1.9.1] - 2024-05-09

### Fixed

- Split headers only on the first `=` character

### Changed

- Update dependencies
- Update dev dependencies

## [1.9.0] - 2024-05-04

### Added

- Support for `https` endpoints (proto over http).
- Update to node 20.x

[unreleased]: https://github.com/dash0hq/otel-cicd-action/compare/v4.1.1...HEAD
[4.1.1]: https://github.com/dash0hq/otel-cicd-action/compare/v4.1.0...v4.1.1
[4.1.0]: https://github.com/dash0hq/otel-cicd-action/compare/v4.0.1...v4.1.0
[4.0.1]: https://github.com/dash0hq/otel-cicd-action/compare/v4.0.0...v4.0.1
[4.0.0]: https://github.com/dash0hq/otel-cicd-action/compare/v3.0.0...v4.0.0
[3.0.0]: https://github.com/dash0hq/otel-cicd-action/compare/v2.2.4...v3.0.0
[2.2.4]: https://github.com/dash0hq/otel-cicd-action/compare/v2.2.3...v2.2.4
[2.2.3]: https://github.com/dash0hq/otel-cicd-action/compare/v2.2.2...v2.2.3
[2.2.2]: https://github.com/dash0hq/otel-cicd-action/compare/v2.2.1...v2.2.2
[2.2.1]: https://github.com/dash0hq/otel-cicd-action/compare/v2.2.0...v2.2.1
[2.2.0]: https://github.com/dash0hq/otel-cicd-action/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/dash0hq/otel-cicd-action/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/dash0hq/otel-cicd-action/compare/v1.13.2...v2.0.0
[1.13.2]: https://github.com/dash0hq/otel-cicd-action/compare/v1.13.1...v1.13.2
[1.13.1]: https://github.com/dash0hq/otel-cicd-action/compare/v1.13.0...v1.13.1
[1.13.0]: https://github.com/dash0hq/otel-cicd-action/compare/v1.12.1...v1.13.0
[1.12.1]: https://github.com/dash0hq/otel-cicd-action/compare/v1.12.0...v1.12.1
[1.12.0]: https://github.com/dash0hq/otel-cicd-action/compare/v1.11.0...v1.12.0
[1.11.0]: https://github.com/dash0hq/otel-cicd-action/compare/v1.10.0...v1.11.0
[1.10.0]: https://github.com/dash0hq/otel-cicd-action/compare/v1.9.1...v1.10.0
[1.9.1]: https://github.com/dash0hq/otel-cicd-action/compare/v1.9.0...v1.9.1
[1.9.0]: https://github.com/dash0hq/otel-cicd-action/releases/tag/v1.9.0

Versions previous to 1.9.0 were developed in another repository. To see previous changelog entries see the [CHANGELOG.md](https://github.com/inception-health/otel-export-trace-action/blob/v1.8.0/CHANGELOG.md).
