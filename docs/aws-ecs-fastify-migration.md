# AWS ECS and Fastify Migration

This document defines the target deployment model for moving GLAPI from the current Vercel-hosted Next.js API/web runtime to AWS ECS with a Fastify API server.

## Environments

| Environment | Branch | Web | API | API Docs |
| --- | --- | --- | --- | --- |
| Staging | `staging` | `https://glapi-staging.adteco.com` | `https://glapi-staging-api.adteco.com` | `https://glapi-staging-api.adteco.com/docs` |
| Production | `main` | `https://glapi.adteco.com` | `https://glapi-api.adteco.com` | `https://glapi-api.adteco.com/docs` |

Staging and production use separate Better Auth secrets, provider callback URLs, API keys, and Secrets Manager secrets. The initial AWS cutover points both environments at the existing GLAPI-compatible Postgres endpoint; split databases can be introduced later by changing each environment secret.

## Runtime Targets

- Web: `apps/web` builds as a Next.js standalone container with `apps/web/Dockerfile`.
- API: `apps/api-fastify` builds as a Fastify container with `apps/api-fastify/Dockerfile`.
- Authentication: Fastify serves Better Auth at `/api/auth/*`; browser API calls authenticate with the Better Auth session cookie, while SDK/server clients use `x-api-key`.
- API documentation: Fastify serves generated OpenAPI at `/openapi.json` and Swagger UI at `/docs`.
- Infrastructure: `infra/aws-ecs` provisions ECR, ALB, ECS/Fargate services, CloudWatch logs, IAM task roles, Route53 aliases, and staging/production configuration.

## API-First Rules

- Public API behavior must be represented in OpenAPI.
- CI regenerates the OpenAPI document and fails if generated artifacts drift.
- New API routes should be implemented behind shared service/package boundaries before transport adapters.
- Web code should consume the public API boundary instead of importing database runtime packages.

## Deployment Flow

The AWS deployment workflows mirror the Sureshake pattern:

1. Deploy staging from `staging`.
2. Build and push a commit-tagged image to ECR.
3. Register a new ECS task definition revision.
4. Update the ECS service and wait for stability.
5. Verify that the running task definition uses the expected image tag.
6. Run health and smoke checks.
7. Run staging regression.
8. Open/refresh a promotion PR from `staging` to `main`.
9. Deploy production from `main`.
10. Run production-safe verification.

## Provisioning

Provision each environment:

```bash
cd infra/aws-ecs
terraform init
terraform workspace select staging || terraform workspace new staging
terraform apply -var-file=environments/staging.tfvars

terraform workspace select prod || terraform workspace new prod
terraform apply -var-file=environments/prod.tfvars
```

The deployment workflows expect:

- GitHub Actions variable `AWS_ACCOUNT_ID`
- GitHub Actions secrets `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
- Existing ACM certificate covering the web and API hostnames
- Existing Secrets Manager JSON secrets named by each environment tfvars file
- Route53 hosted zone for `adteco.com`; Terraform creates the web and API alias records

Secrets Manager JSON shape:

```json
{
  "DATABASE_URL": "postgres://...",
  "BETTER_AUTH_SECRET": "generate-a-strong-random-secret",
  "GLAPI_API_KEYS_JSON": "{\"glapi_live_sk_...\":{\"organizationId\":\"...\",\"actorEntityId\":\"...\",\"name\":\"Production API key\",\"scopes\":[\"read\",\"write\"]}}"
}
```

The web secret only requires `DATABASE_URL` and `BETTER_AUTH_SECRET`. The API secret also requires `GLAPI_API_KEYS_JSON` when server-to-server or SDK clients are enabled. Use distinct `BETTER_AUTH_SECRET` and API keys per environment.

## Current Migration Boundary

`apps/api-fastify` exposes the existing tRPC router, Better Auth endpoints, generated OpenAPI docs, and API-key machine access. The existing Next API can remain as a fallback until legacy REST route parity and the final DNS cutover are complete.
