# AWS ECS and Fastify Migration

This document defines the target deployment model for moving GLAPI from the current Vercel-hosted Next.js API/web runtime to AWS ECS with a Fastify API server.

## Environments

| Environment | Branch | Web | API | API Docs |
| --- | --- | --- | --- | --- |
| Staging | `staging` | `https://staging.glapi.net` | `https://staging-api.glapi.net` | `https://staging-api.glapi.net/docs` |
| Production | `main` | `https://web.glapi.net` | `https://api.glapi.net` | `https://api.glapi.net/docs` |

Staging and production must use separate databases, provider callback URLs, API keys, and Secrets Manager secrets.

## Runtime Targets

- Web: `apps/web` builds as a Next.js standalone container with `apps/web/Dockerfile`.
- API: `apps/api-fastify` builds as a Fastify container with `apps/api-fastify/Dockerfile`.
- API documentation: Fastify serves generated OpenAPI at `/openapi.json` and Swagger UI at `/docs`.
- Infrastructure: `infra/aws-ecs` provisions ECR, ALB, ECS/Fargate services, CloudWatch logs, IAM task roles, and staging/production configuration templates.

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

Create environment tfvars from the templates:

```bash
cp infra/aws-ecs/environments/staging.tfvars.example infra/aws-ecs/environments/staging.tfvars
cp infra/aws-ecs/environments/prod.tfvars.example infra/aws-ecs/environments/prod.tfvars
```

Then provision each environment:

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
- Existing Secrets Manager JSON secrets for web and API runtime values
- DNS records pointing the web and API hostnames to the ALB DNS name

## Current Migration Boundary

`apps/api-fastify` initially exposes the existing tRPC router and generated OpenAPI docs. The existing Next API remains available until REST route parity, bearer auth parity, web proxy updates, and production cutover are complete.
