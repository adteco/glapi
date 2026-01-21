/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class InvoicesService {
    /**
     * List all invoices
     * @returns any Successful response
     * @throws ApiError
     */
    public static invoicesList(): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/invoices',
            errors: {
                401: `Unauthorized - Invalid or missing authentication`,
                404: `Resource not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Create a new invoices
     * @returns any Successful response
     * @throws ApiError
     */
    public static invoicesCreate({
        requestBody,
    }: {
        requestBody: Record<string, any>,
    }): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/invoices',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized - Invalid or missing authentication`,
                404: `Resource not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get a specific invoices by ID
     * @returns any Successful response
     * @throws ApiError
     */
    public static invoicesGet({
        id,
    }: {
        /**
         * invoices ID
         */
        id: string,
    }): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/invoices/{id}',
            path: {
                'id': id,
            },
            errors: {
                401: `Unauthorized - Invalid or missing authentication`,
                404: `Resource not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Update an existing invoices
     * @returns any Successful response
     * @throws ApiError
     */
    public static invoicesUpdate({
        id,
        requestBody,
    }: {
        /**
         * invoices ID
         */
        id: string,
        requestBody: Record<string, any>,
    }): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/invoices/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized - Invalid or missing authentication`,
                404: `Resource not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Delete a invoices
     * @returns any Successful response
     * @throws ApiError
     */
    public static invoicesDelete({
        id,
    }: {
        /**
         * invoices ID
         */
        id: string,
    }): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/invoices/{id}',
            path: {
                'id': id,
            },
            errors: {
                401: `Unauthorized - Invalid or missing authentication`,
                404: `Resource not found`,
                500: `Internal server error`,
            },
        });
    }
}
