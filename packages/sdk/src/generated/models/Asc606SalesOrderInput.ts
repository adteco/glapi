/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Asc606SalesOrderLineInput } from './Asc606SalesOrderLineInput';
export type Asc606SalesOrderInput = {
    subsidiaryId: string;
    entityId: string;
    orderDate: string;
    externalReference?: string;
    billingAddressId?: string;
    shippingAddressId?: string;
    requestedDeliveryDate?: string;
    promisedDeliveryDate?: string;
    expirationDate?: string;
    currencyCode?: string;
    exchangeRate?: (number | string);
    discountAmount?: (number | string);
    discountPercent?: (number | string);
    shippingAmount?: (number | string);
    paymentTerms?: string;
    shippingMethod?: string;
    memo?: string;
    internalNotes?: string;
    metadata?: Record<string, any>;
    requiresApproval?: boolean;
    approvalThreshold?: (number | string);
    lines: Array<Asc606SalesOrderLineInput>;
};

