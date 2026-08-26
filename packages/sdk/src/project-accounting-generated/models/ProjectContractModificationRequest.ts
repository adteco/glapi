/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ProjectContractModificationRequest = {
    priorVersionId: string;
    revisedVersionId: string;
    method: 'prospective' | 'cumulative_catch_up' | 'separate_contract';
    effectiveDate: string;
    progressPercentage?: string;
    reason: string;
};

