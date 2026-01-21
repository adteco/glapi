/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class VendorsService {
    /**
     * List all vendors
     * @returns any Successful response
     * @throws ApiError
     */
    public static vendorsList(): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/vendors',
            errors: {
                401: `Unauthorized - Invalid or missing authentication`,
                404: `Resource not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Create a new vendors
     * @returns any Successful response
     * @throws ApiError
     */
    public static vendorsCreate({
        requestBody,
    }: {
        requestBody: Record<string, any>,
    }): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/vendors',
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
     * Get a specific vendors by ID
     * @returns any Successful response
     * @throws ApiError
     */
    public static vendorsGet({
        id,
    }: {
        /**
         * vendors ID
         */
        id: string,
    }): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/vendors/{id}',
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
     * Update an existing vendors
     * @returns any Successful response
     * @throws ApiError
     */
    public static vendorsUpdate({
        id,
        requestBody,
    }: {
        /**
         * vendors ID
         */
        id: string,
        requestBody: Record<string, any>,
    }): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/vendors/{id}',
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
     * Delete a vendors
     * @returns any Successful response
     * @throws ApiError
     */
    public static vendorsDelete({
        id,
    }: {
        /**
         * vendors ID
         */
        id: string,
    }): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/vendors/{id}',
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
