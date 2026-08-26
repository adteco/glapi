/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ProjectBillingTransitionRequest = {
    action: 'void' | 'release' | 'transfer' | 'rebill';
    reason: string;
    targetInvoiceId?: string;
    invoiceDate?: string;
    dueDate?: string;
};

