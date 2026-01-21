/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class SubsidiariesService {
    /**
     * List all subsidiaries
     * @returns any Successful response
     * @throws ApiError
     */
    public static subsidiariesList(): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/subsidiaries',
            errors: {
                401: `Unauthorized - Invalid or missing authentication`,
                404: `Resource not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Create a new subsidiaries
     * @returns any Successful response
     * @throws ApiError
     */
    public static subsidiariesCreate({
        requestBody,
    }: {
        requestBody: Record<string, any>,
    }): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/subsidiaries',
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
     * Get a specific subsidiaries by ID
     * @returns any Successful response
     * @throws ApiError
     */
    public static subsidiariesGet({
        id,
    }: {
        /**
         * subsidiaries ID
         */
        id: string,
    }): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/subsidiaries/{id}',
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
     * Update an existing subsidiaries
     * @returns any Successful response
     * @throws ApiError
     */
    public static subsidiariesUpdate({
        id,
        requestBody,
    }: {
        /**
         * subsidiaries ID
         */
        id: string,
        requestBody: Record<string, any>,
    }): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/subsidiaries/{id}',
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
     * Delete a subsidiaries
     * @returns any Successful response
     * @throws ApiError
     */
    public static subsidiariesDelete({
        id,
    }: {
        /**
         * subsidiaries ID
         */
        id: string,
    }): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/subsidiaries/{id}',
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
