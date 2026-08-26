/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ProjectAccountingCommandResponse } from '../models/ProjectAccountingCommandResponse';
import type { ProjectContractModificationRequest } from '../models/ProjectContractModificationRequest';
import type { ProjectRecognitionReversalRequest } from '../models/ProjectRecognitionReversalRequest';
import type { ProjectRecognitionRunRequest } from '../models/ProjectRecognitionRunRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ProjectRevenueAsc606Service {
    /**
     * Get a persisted project revenue plan
     * @returns ProjectAccountingCommandResponse Project revenue plan
     * @throws ApiError
     */
    public static getProjectRevenuePlan({
        versionId,
    }: {
        versionId: string,
    }): CancelablePromise<ProjectAccountingCommandResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/v1/project-revenue/plans/{versionId}',
            path: {
                'versionId': versionId,
            },
            errors: {
                400: `Invalid request or missing idempotency key`,
                404: `Project accounting resource not found`,
                409: `Accounting state, period, concurrency, or idempotency conflict`,
                422: `Accounting calculation validation failed`,
            },
        });
    }
    /**
     * Generate a project ASC 606 revenue plan
     * @returns ProjectAccountingCommandResponse Generated project revenue plan
     * @throws ApiError
     */
    public static generateProjectRevenuePlan({
        versionId,
    }: {
        versionId: string,
    }): CancelablePromise<ProjectAccountingCommandResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/v1/project-revenue/plans/{versionId}',
            path: {
                'versionId': versionId,
            },
            errors: {
                400: `Invalid request or missing idempotency key`,
                404: `Project accounting resource not found`,
                409: `Accounting state, period, concurrency, or idempotency conflict`,
                422: `Accounting calculation validation failed`,
            },
        });
    }
    /**
     * Preview a project ASC 606 revenue plan
     * @returns ProjectAccountingCommandResponse Project revenue plan preview
     * @throws ApiError
     */
    public static previewProjectRevenuePlan({
        versionId,
    }: {
        versionId: string,
    }): CancelablePromise<ProjectAccountingCommandResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/v1/project-revenue/plans/{versionId}/preview',
            path: {
                'versionId': versionId,
            },
            errors: {
                400: `Invalid request or missing idempotency key`,
                404: `Project accounting resource not found`,
                409: `Accounting state, period, concurrency, or idempotency conflict`,
                422: `Accounting calculation validation failed`,
            },
        });
    }
    /**
     * Preview an open-period recognition run
     * @returns ProjectAccountingCommandResponse Recognition run preview
     * @throws ApiError
     */
    public static previewProjectRevenueRecognitionRun({
        requestBody,
    }: {
        requestBody: ProjectRecognitionRunRequest,
    }): CancelablePromise<ProjectAccountingCommandResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/v1/project-revenue/recognition-runs/preview',
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
     * Execute an atomic recognition run
     * @returns ProjectAccountingCommandResponse Completed recognition run
     * @throws ApiError
     */
    public static executeProjectRevenueRecognitionRun({
        idempotencyKey,
        requestBody,
    }: {
        /**
         * Client-generated key. Exact replay returns the original result; changed reuse returns 409.
         */
        idempotencyKey: string,
        requestBody: ProjectRecognitionRunRequest,
    }): CancelablePromise<ProjectAccountingCommandResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/v1/project-revenue/recognition-runs',
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
     * Post a recognition run to the GL
     * @returns ProjectAccountingCommandResponse Recognition run GL posting
     * @throws ApiError
     */
    public static postProjectRevenueRecognitionRun({
        runId,
        idempotencyKey,
    }: {
        runId: string,
        /**
         * Client-generated key. Exact replay returns the original result; changed reuse returns 409.
         */
        idempotencyKey: string,
    }): CancelablePromise<ProjectAccountingCommandResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/v1/project-revenue/recognition-runs/{runId}/post',
            path: {
                'runId': runId,
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
    /**
     * Preview an ASC 606 project-contract modification
     * @returns ProjectAccountingCommandResponse Modification preview
     * @throws ApiError
     */
    public static previewProjectContractModification({
        requestBody,
    }: {
        requestBody: ProjectContractModificationRequest,
    }): CancelablePromise<ProjectAccountingCommandResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/v1/project-revenue/modifications/preview',
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
     * Apply a project-contract modification and catch-up
     * @returns ProjectAccountingCommandResponse Applied project-contract modification
     * @throws ApiError
     */
    public static applyProjectContractModification({
        idempotencyKey,
        requestBody,
    }: {
        /**
         * Client-generated key. Exact replay returns the original result; changed reuse returns 409.
         */
        idempotencyKey: string,
        requestBody: ProjectContractModificationRequest,
    }): CancelablePromise<ProjectAccountingCommandResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/v1/project-revenue/modifications',
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
     * Reverse a posted recognition run in an open period
     * @returns ProjectAccountingCommandResponse Posted recognition reversal
     * @throws ApiError
     */
    public static reverseProjectRevenueRecognitionRun({
        idempotencyKey,
        requestBody,
    }: {
        /**
         * Client-generated key. Exact replay returns the original result; changed reuse returns 409.
         */
        idempotencyKey: string,
        requestBody: ProjectRecognitionReversalRequest,
    }): CancelablePromise<ProjectAccountingCommandResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/v1/project-revenue/recognition-reversals',
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
}
