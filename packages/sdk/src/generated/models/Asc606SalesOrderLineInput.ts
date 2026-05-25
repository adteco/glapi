/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Asc606SalesOrderLineInput = {
    id?: string;
    itemId?: string;
    description: string;
    sku?: string;
    quantity: (number | string);
    unitOfMeasure?: string;
    unitPrice: (number | string);
    discountAmount?: (number | string);
    discountPercent?: (number | string);
    taxAmount?: (number | string);
    taxCode?: string;
    requestedDeliveryDate?: string;
    promisedDeliveryDate?: string;
    departmentId?: string;
    locationId?: string;
    classId?: string;
    projectId?: string;
    revenueAccountId?: string;
    deferredRevenueAccountId?: string;
    revenueBehavior?: 'point_in_time' | 'over_time';
    sspAmount?: (number | string);
    listPrice?: (number | string);
    memo?: string;
    metadata?: Record<string, any>;
    _delete?: boolean;
};

