# CI/CD (Phase 10)

GitHub Actions pipeline. YAML is validated (js-yaml/actionlint) but the **AWS deploy
steps have not been executed** here — no cloud account/OIDC in this environment.

## Workflows

| File | Trigger | What it does |
|---|---|---|
| `ci.yml` | PR + push (all branches) | **quality** (lint, typecheck, build all apps) · **test** (Postgres+Redis service containers → `prisma migrate deploy` → API tests) · **security** (tfsec + checkov on `terraform/`, `pnpm audit --audit-level high`). Fails on high/critical. |
| `terraform.yml` | PR/push touching `terraform/**` | fmt + `validate` (no cloud); `plan` on PRs; `apply` on push to `main` gated by the `staging-infra` environment (required reviewers). |
| `deploy-staging.yml` | push to `main` | build `api`/`web`/`staff` images → push to ECR tagged with the commit SHA → `prisma migrate deploy` → `aws ecs update-service --force-new-deployment` → `aws ecs wait services-stable`. |
| `promote-prod.yml` | manual (`workflow_dispatch`, input `image_sha`) | **retags the already-tested SHA image** to `prod` (no rebuild) → rolls prod ECS → waits stable. Gated by the `production` environment. |
| `dependabot.yml` | schedule | weekly npm + github-actions + terraform update PRs. |

## Required GitHub configuration (not set here)

**Secrets:** `AWS_TERRAFORM_ROLE_ARN`, `AWS_DEPLOY_ROLE_ARN`, `AWS_PROD_DEPLOY_ROLE_ARN`
(OIDC roles), `STAGING_DATABASE_URL`.
**Variables:** `AWS_REGION`, `ECR_REGISTRY`, `STAGING_ASSETS_BUCKET`.
**Environments:** `staging-infra`, `staging`, `production` — add required reviewers to
gate applies/deploys/promotions.

## Design notes

- **Promote = retag, never rebuild** — the exact bytes tested in staging are what ship
  to prod (Plan/03 Phase 10).
- **Migrations run before the ECS roll**, as their own gated job.
- The **dependency-audit gate** ignores a documented set of transitive framework/
  build-tool advisories (`pnpm-workspace.yaml` → `auditConfig.ignoreGhsas`) that have
  no direct fix and don't ship in the server containers; it still fails on any NEW
  high/critical. See the comment there.
- **tfsec** (verified clean in Phase 1) is the hard IaC gate; **checkov** runs
  informationally (`soft_fail: true`) until its baseline is triaged in Phase 11.
