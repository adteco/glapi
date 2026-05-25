/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Asc606CreateSalesOrderPlanRequest } from '../models/Asc606CreateSalesOrderPlanRequest';
import type { Asc606GenerateSalesOrderPlanRequest } from '../models/Asc606GenerateSalesOrderPlanRequest';
import type { Asc606LicenseChangeApplyResponse } from '../models/Asc606LicenseChangeApplyResponse';
import type { Asc606LicenseChangePreviewResponse } from '../models/Asc606LicenseChangePreviewResponse';
import type { Asc606LicenseChangeRequest } from '../models/Asc606LicenseChangeRequest';
import type { Asc606SalesOrderPlanResponse } from '../models/Asc606SalesOrderPlanResponse';
import type { Asc606SubscriptionPlan } from '../models/Asc606SubscriptionPlan';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class RevenueAsc606Service {
    /**
     * Create sales order and generate ASC 606 plan
     * Creates a sales order and immediately returns generated ASC 606 obligations, schedules, and waterfall output.
     * @returns Asc606SalesOrderPlanResponse Sales order and ASC 606 plan created
     * @throws ApiError
     */
    public static createSalesOrderRevenuePlan({
        requestBody,
        xOrganizationId,
        xUserId,
    }: {
        requestBody: Asc606CreateSalesOrderPlanRequest,
        /**
         * Organization context for the request. API keys may also provide this context.
         */
        xOrganizationId?: string,
        /**
         * Actor ID used for audit attribution on server-to-server requests.
         */
        xUserId?: string,
    }): CancelablePromise<Asc606SalesOrderPlanResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/revenue/asc606/sales-orders',
            headers: {
                'x-organization-id': xOrganizationId,
                'x-user-id': xUserId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Bad request`,
                401: `Unauthorized - Invalid or missing authentication`,
                403: `Forbidden`,
                404: `Resource not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Generate ASC 606 plan for an existing sales order
     * Generates or regenerates ASC 606 plan outputs for an existing sales order.
     * @returns Asc606SalesOrderPlanResponse ASC 606 plan generated
     * @throws ApiError
     */
    public static generateSalesOrderRevenuePlan({
        salesOrderId,
        requestBody,
        xOrganizationId,
        xUserId,
    }: {
        /**
         * Sales order ID
         */
        salesOrderId: string,
        requestBody: Asc606GenerateSalesOrderPlanRequest,
        /**
         * Organization context for the request. API keys may also provide this context.
         */
        xOrganizationId?: string,
        /**
         * Actor ID used for audit attribution on server-to-server requests.
         */
        xUserId?: string,
    }): CancelablePromise<Asc606SalesOrderPlanResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/revenue/asc606/sales-orders/{salesOrderId}/plan',
            path: {
                'salesOrderId': salesOrderId,
            },
            headers: {
                'x-organization-id': xOrganizationId,
                'x-user-id': xUserId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Bad request`,
                401: `Unauthorized - Invalid or missing authentication`,
                403: `Forbidden`,
                404: `Resource not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get ASC 606 subscription plan
     * Returns subscription-level ASC 606 summary, obligations, allocations, schedules, invoice schedule, and waterfall output.
     * @returns Asc606SubscriptionPlan ASC 606 subscription plan
     * @throws ApiError
     */
    public static getSubscriptionRevenuePlan({
        subscriptionId,
        xOrganizationId,
        xUserId,
        startDate,
        endDate,
    }: {
        /**
         * Subscription ID
         */
        subscriptionId: string,
        /**
         * Organization context for the request. API keys may also provide this context.
         */
        xOrganizationId?: string,
        /**
         * Actor ID used for audit attribution on server-to-server requests.
         */
        xUserId?: string,
        /**
         * Inclusive schedule period start date filter.
         */
        startDate?: string,
        /**
         * Inclusive schedule period end date filter.
         */
        endDate?: string,
    }): CancelablePromise<Asc606SubscriptionPlan> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/revenue/asc606/subscriptions/{subscriptionId}/plan',
            path: {
                'subscriptionId': subscriptionId,
            },
            headers: {
                'x-organization-id': xOrganizationId,
                'x-user-id': xUserId,
            },
            query: {
                'startDate': startDate,
                'endDate': endDate,
            },
            errors: {
                400: `Bad request`,
                401: `Unauthorized - Invalid or missing authentication`,
                403: `Forbidden`,
                404: `Resource not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Preview ASC 606 license change impact
     * Returns what-if ASC 606 allocation impact for a software license add/remove change without persisting the amendment.
     * @returns Asc606LicenseChangePreviewResponse License change preview
     * @throws ApiError
     */
    public static previewLicenseChange({
        subscriptionId,
        requestBody,
        xOrganizationId,
        xUserId,
    }: {
        /**
         * Subscription ID
         */
        subscriptionId: string,
        requestBody: Asc606LicenseChangeRequest,
        /**
         * Organization context for the request. API keys may also provide this context.
         */
        xOrganizationId?: string,
        /**
         * Actor ID used for audit attribution on server-to-server requests.
         */
        xUserId?: string,
    }): CancelablePromise<Asc606LicenseChangePreviewResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/revenue/asc606/subscriptions/{subscriptionId}/license-changes/preview',
            path: {
                'subscriptionId': subscriptionId,
            },
            headers: {
                'x-organization-id': xOrganizationId,
                'x-user-id': xUserId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Bad request`,
                401: `Unauthorized - Invalid or missing authentication`,
                403: `Forbidden`,
                404: `Resource not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Apply ASC 606 license change
     * Persists a software license add/remove amendment and returns recalculated ASC 606 outputs.
     * @returns Asc606LicenseChangeApplyResponse License change applied
     * @throws ApiError
     */
    public static applyLicenseChange({
        subscriptionId,
        requestBody,
        xOrganizationId,
        xUserId,
    }: {
        /**
         * Subscription ID
         */
        subscriptionId: string,
        requestBody: Asc606LicenseChangeRequest,
        /**
         * Organization context for the request. API keys may also provide this context.
         */
        xOrganizationId?: string,
        /**
         * Actor ID used for audit attribution on server-to-server requests.
         */
        xUserId?: string,
    }): CancelablePromise<Asc606LicenseChangeApplyResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/revenue/asc606/subscriptions/{subscriptionId}/license-changes/apply',
            path: {
                'subscriptionId': subscriptionId,
            },
            headers: {
                'x-organization-id': xOrganizationId,
                'x-user-id': xUserId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Bad request`,
                401: `Unauthorized - Invalid or missing authentication`,
                403: `Forbidden`,
                404: `Resource not found`,
                500: `Internal server error`,
            },
        });
    }
}
