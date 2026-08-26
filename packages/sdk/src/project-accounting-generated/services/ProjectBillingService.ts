/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ProjectAccountingCommandResponse } from '../models/ProjectAccountingCommandResponse';
import type { ProjectBillingDraftRequest } from '../models/ProjectBillingDraftRequest';
import type { ProjectBillingPreviewRequest } from '../models/ProjectBillingPreviewRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ProjectBillingService {
    /**
     * List eligible project billing sources
     * @returns ProjectAccountingCommandResponse Eligible billing candidates
     * @throws ApiError
     */
    public static listProjectBillingCandidates({
        page,
        limit,
        customerId,
        projectId,
        sourceTypes,
        asOfDate,
    }: {
        page?: number,
        limit?: number,
        customerId?: string,
        projectId?: string,
        sourceTypes?: string,
        asOfDate?: string,
    }): CancelablePromise<ProjectAccountingCommandResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/v1/project-billing/candidates',
            query: {
                'page': page,
                'limit': limit,
                'customerId': customerId,
                'projectId': projectId,
                'sourceTypes': sourceTypes,
                'asOfDate': asOfDate,
            },
        });
    }
    /**
     * Preview grouped project invoice drafts
     * @returns ProjectAccountingCommandResponse Project invoice draft preview
     * @throws ApiError
     */
    public static previewProjectInvoiceDrafts({
        requestBody,
    }: {
        requestBody: ProjectBillingPreviewRequest,
    }): CancelablePromise<ProjectAccountingCommandResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/v1/project-billing/preview',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid request or missing idempotency key`,
                404: `Project accounting resource not found`,
                409: `Accounting state, period, concurrency, or idempotency conflict`,
                422: `Accounting calculation validation failed`,
            },
        });
    }
    /**
     * Create project invoice drafts atomically
     * @returns ProjectAccountingCommandResponse Created project invoice drafts
     * @throws ApiError
     */
    public static createProjectInvoiceDrafts({
        idempotencyKey,
        requestBody,
    }: {
        /**
         * Client-generated key. Exact replay returns the original result; changed reuse returns 409.
         */
        idempotencyKey: string,
        requestBody: ProjectBillingDraftRequest,
    }): CancelablePromise<ProjectAccountingCommandResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/v1/project-billing/drafts',
            headers: {
                'Idempotency-Key': idempotencyKey,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid request or missing idempotency key`,
                404: `Project accounting resource not found`,
                409: `Accounting state, period, concurrency, or idempotency conflict`,
                422: `Accounting calculation validation failed`,
            },
        });
    }
    /**
     * Post an issued project invoice to the GL
     * @returns ProjectAccountingCommandResponse Project invoice GL posting
     * @throws ApiError
     */
    public static postProjectInvoiceToGl({
        invoiceId,
        idempotencyKey,
    }: {
        invoiceId: string,
        /**
         * Client-generated key. Exact replay returns the original result; changed reuse returns 409.
         */
        idempotencyKey: string,
    }): CancelablePromise<ProjectAccountingCommandResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/v1/project-billing/invoices/{invoiceId}/post',
            path: {
                'invoiceId': invoiceId,
            },
            headers: {
                'Idempotency-Key': idempotencyKey,
            },
            errors: {
                400: `Invalid request or missing idempotency key`,
                404: `Project accounting resource not found`,
                409: `Accounting state, period, concurrency, or idempotency conflict`,
                422: `Accounting calculation validation failed`,
            },
        });
    }
}
