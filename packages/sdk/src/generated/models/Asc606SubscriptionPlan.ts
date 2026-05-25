/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Asc606SubscriptionPlan = {
    subscription?: Record<string, any>;
    summary?: {
        totalScheduled?: number;
        totalRecognized?: number;
        totalDeferred?: number;
    };
    obligations?: Array<Record<string, any>>;
    allocations?: Array<Record<string, any>>;
    invoiceSchedule?: Array<{
        invoiceDate?: string;
        amount?: number;
    }>;
    schedules?: Array<Record<string, any>>;
    waterfall?: Array<{
        period?: string;
        scheduled?: number;
        recognized?: number;
        deferredBalance?: number;
    }>;
};

