/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class LeadsService {
    /**
     * List all leads
     * @returns any Successful response
     * @throws ApiError
     */
    public static leadsList(): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/leads',
            errors: {
                401: `Unauthorized - Invalid or missing authentication`,
                404: `Resource not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Create a new leads
     * @returns any Successful response
     * @throws ApiError
     */
    public static leadsCreate({
        requestBody,
    }: {
        requestBody: Record<string, any>,
    }): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/leads',
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
     * Get a specific leads by ID
     * @returns any Successful response
     * @throws ApiError
     */
    public static leadsGet({
        id,
    }: {
        /**
         * leads ID
         */
        id: string,
    }): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/leads/{id}',
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
     * Update an existing leads
     * @returns any Successful response
     * @throws ApiError
     */
    public static leadsUpdate({
        id,
        requestBody,
    }: {
        /**
         * leads ID
         */
        id: string,
        requestBody: Record<string, any>,
    }): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/leads/{id}',
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
     * Delete a leads
     * @returns any Successful response
     * @throws ApiError
     */
    public static leadsDelete({
        id,
    }: {
        /**
         * leads ID
         */
        id: string,
    }): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/leads/{id}',
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
