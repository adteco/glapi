import { BaseService } from './base-service';
import {
  CreatePayApplicationInput,
  UpdatePayAppLinesInput,
  SubmitPayAppInput,
  ApprovePayAppInput,
  RejectPayAppInput,
  CertifyPayAppInput,
  BillPayAppInput,
  RecordPaymentInput,
  VoidPayAppInput,
  PayAppLineWithProgress,
  PayAppSummary,
  G702Application,
  PayAppValidationResult,
  PayAppValidationError,
  PayAppValidationWarning,
  PayAppMathValidation,
  CreateRetainageReleaseInput,
  ApproveRetainageReleaseInput,
  RetainageReleaseSummary,
  ListPayAppFilter,
  PAY_APP_STATUS,
  PAY_APP_TYPE,
  PayAppStatus,
} from '../types/pay-applications.types';
import { PaginationParams, PaginatedResult, ServiceError } from '../types';
import { PayApplicationRepository, SovRepository } from '@glapi/database';

// Valid status transitions
const VALID_PAY_APP_STATUS_TRANSITIONS: Record<PayAppStatus, PayAppStatus[]> = {
  DRAFT: ['SUBMITTED', 'VOIDED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'DRAFT'],
  APPROVED: ['CERTIFIED', 'REJECTED'],
  CERTIFIED: ['BILLED'],
  BILLED: ['PAID'],
  PAID: [],
  REJECTED: ['DRAFT'],
  VOIDED: [],
};

export class PayApplicationService extends BaseService {
  private payAppRepository: PayApplicationRepository;
  private sovRepository: SovRepository;

  constructor(context = {}) {
    super(context);
    this.payAppRepository = new PayApplicationRepository();
    this.sovRepository = new SovRepository();
  }

  /**
   * Transform database pay application to service layer type
   */
  private transformPayApp(dbPayApp: any): PayAppSummary {
    return {
      id: dbPayApp.id,
      applicationNumber: dbPayApp.applicationNumber,
      applicationDate: dbPayApp.applicationDate,
      periodFrom: dbPayApp.periodFrom,
      periodTo: dbPayApp.periodTo,
      payAppType: dbPayApp.payAppType,
      status: dbPayApp.status,
      projectId: dbPayApp.projectId,
      projectName: '', // Will be populated if needed
      projectCode: '', // Will be populated if needed
      contractSumToDate: parseFloat(dbPayApp.contractSumToDate || '0'),
      totalCompletedAndStoredToDate: parseFloat(dbPayApp.totalCompletedAndStoredToDate || '0'),
      totalRetainage: parseFloat(dbPayApp.totalRetainage || '0'),
      totalEarnedLessRetainage: parseFloat(dbPayApp.totalEarnedLessRetainage || '0'),
      lessPreviousCertificates: parseFloat(dbPayApp.lessPreviousCertificates || '0'),
      currentPaymentDue: parseFloat(dbPayApp.currentPaymentDue || '0'),
      balanceToFinish: parseFloat(dbPayApp.balanceToFinish || '0'),
      submittedDate: dbPayApp.submittedDate,
      approvedDate: dbPayApp.approvedDate,
      certifiedDate: dbPayApp.certifiedDate,
      billedDate: dbPayApp.billedDate,
      paidDate: dbPayApp.paidDate,
      invoiceNumber: dbPayApp.invoiceNumber,
    };
  }

  /**
   * Transform database pay app line to service layer type
   */
  private transformPayAppLine(dbLine: any, sovLine?: any): PayAppLineWithProgress {
    const scheduledValue = parseFloat(sovLine?.revisedScheduledValue || dbLine.scheduledValue || '0');
    const previousWorkCompleted = parseFloat(dbLine.previousWorkCompleted || '0');
    const previousMaterialsStored = parseFloat(dbLine.previousMaterialsStored || '0');
    const thisWorkCompleted = parseFloat(dbLine.thisWorkCompleted || '0');
    const thisMaterialsStored = parseFloat(dbLine.thisMaterialsStored || '0');
    const totalCompletedAndStored = previousWorkCompleted + previousMaterialsStored +
      thisWorkCompleted + thisMaterialsStored;
    const percentComplete = scheduledValue > 0
      ? (totalCompletedAndStored / scheduledValue) * 100
      : 0;

    return {
      id: dbLine.id,
      lineNumber: dbLine.lineNumber,
      itemNumber: sovLine?.itemNumber,
      description: sovLine?.description || '',
      scheduledValue,
      previousWorkCompleted,
      previousMaterialsStored,
      thisWorkCompleted,
      thisMaterialsStored,
      totalCompletedAndStored,
      percentComplete,
      balanceToFinish: scheduledValue - totalCompletedAndStored,
      retainagePercent: parseFloat(dbLine.retainagePercent || '10'),
      retainageAmount: parseFloat(dbLine.retainageAmount || '0'),
      adjustedThisWorkCompleted: dbLine.approvedWorkCompleted
        ? parseFloat(dbLine.approvedWorkCompleted)
        : undefined,
      adjustedThisMaterialsStored: dbLine.approvedMaterialsStored
        ? parseFloat(dbLine.approvedMaterialsStored)
        : undefined,
      adjustmentReason: dbLine.adjustmentReason,
      sovLineId: dbLine.sovLineId,
    };
  }

  // ========== Pay Application Methods ==========

  /**
   * List pay applications with filters and pagination
   */
  async list(
    params: PaginationParams = {},
    filters: ListPayAppFilter
  ): Promise<PaginatedResult<PayAppSummary>> {
    const organizationId = filters.organizationId || this.requireOrganizationContext();

    const result = await this.payAppRepository.findAll(organizationId, params, {
      projectId: filters.projectId,
      scheduleOfValuesId: filters.scheduleOfValuesId,
      status: filters.status as any,
      payAppType: filters.payAppType as any,
      periodFrom: filters.periodFrom,
      periodTo: filters.periodTo,
    });

    return {
      ...result,
      data: result.data.map((payApp) => this.transformPayApp(payApp)),
    };
  }

  /**
   * Get a pay application by ID
   */
  async getById(id: string): Promise<PayAppSummary | null> {
    const organizationId = this.requireOrganizationContext();

    const payApp = await this.payAppRepository.findById(id, organizationId);
    return payApp ? this.transformPayApp(payApp) : null;
  }

  /**
   * Create a new pay application
   */
  async create(input: CreatePayApplicationInput): Promise<PayAppSummary> {
    const organizationId = input.organizationId || this.requireOrganizationContext();
    const userId = this.context.userId;

    // Verify SOV exists and is active
    const sov = await this.sovRepository.findById(input.scheduleOfValuesId, organizationId);
    if (!sov) {
      throw new ServiceError('Schedule of Values not found', 'SOV_NOT_FOUND', 404);
    }

    if (sov.status !== 'ACTIVE') {
      throw new ServiceError(
        'Cannot create pay application for inactive SOV',
        'SOV_NOT_ACTIVE',
        400
      );
    }

    // Get next application number
    const applicationNumber = await this.payAppRepository.getNextApplicationNumber(
      input.scheduleOfValuesId
    );

    // Calculate previous billing totals
    const previousTotals = await this.payAppRepository.calculatePreviousBillingTotals(
      input.scheduleOfValuesId
    );

    const created = await this.payAppRepository.create({
      organizationId,
      projectId: input.projectId,
      scheduleOfValuesId: input.scheduleOfValuesId,
      applicationNumber,
      applicationDate: input.applicationDate,
      periodFrom: input.periodFrom,
      periodTo: input.periodTo,
      payAppType: input.payAppType as any,
      contractorId: input.contractorId,
      ownerId: input.ownerId,
      architectId: input.architectId,
      externalReference: input.externalReference,
      notes: input.notes,
      createdBy: userId,
    });

    // Initialize lines from SOV
    await this.payAppRepository.initializeLinesFromSov(created.id, input.scheduleOfValuesId);

    // Update with previous certificates
    await this.payAppRepository.update(created.id, organizationId, {
      metadata: {
        lessPreviousCertificates: previousTotals.totalPreviousCertificates,
      },
    });

    return this.transformPayApp(created);
  }

  /**
   * Update pay application lines (billing progress)
   */
  async updateLines(input: UpdatePayAppLinesInput): Promise<PayAppLineWithProgress[]> {
    const organizationId = this.requireOrganizationContext();

    const payApp = await this.payAppRepository.findById(input.payApplicationId, organizationId);
    if (!payApp) {
      throw new ServiceError('Pay application not found', 'PAY_APP_NOT_FOUND', 404);
    }

    if (payApp.status !== PAY_APP_STATUS.DRAFT) {
      throw new ServiceError(
        `Cannot update lines for pay application with status "${payApp.status}". Only DRAFT applications can be modified.`,
        'PAY_APP_NOT_EDITABLE',
        400
      );
    }

    const updates = input.lines.map((line) => ({
      id: line.id,
      data: {
        thisWorkCompleted: line.thisWorkCompleted?.toString(),
        thisMaterialsStored: line.thisMaterialsStored?.toString(),
        retainagePercent: line.retainagePercent?.toString(),
        notes: line.notes,
      },
    }));

    await this.payAppRepository.bulkUpdateLines(updates);

    // Recalculate totals
    await this.payAppRepository.recalculateTotals(input.payApplicationId);

    // Get updated lines
    const linesWithSov = await this.payAppRepository.findLinesWithSovDetails(input.payApplicationId);
    return linesWithSov.map(({ line, sovLine }) => this.transformPayAppLine(line, sovLine));
  }

  /**
   * Get lines for a pay application
   */
  async getLines(payApplicationId: string): Promise<PayAppLineWithProgress[]> {
    const organizationId = this.requireOrganizationContext();

    const payApp = await this.payAppRepository.findById(payApplicationId, organizationId);
    if (!payApp) {
      throw new ServiceError('Pay application not found', 'PAY_APP_NOT_FOUND', 404);
    }

    const linesWithSov = await this.payAppRepository.findLinesWithSovDetails(payApplicationId);
    return linesWithSov.map(({ line, sovLine }) => this.transformPayAppLine(line, sovLine));
  }

  // ========== Workflow Methods ==========

  /**
   * Submit a pay application for review
   */
  async submit(input: SubmitPayAppInput): Promise<PayAppSummary> {
    const organizationId = this.requireOrganizationContext();

    const payApp = await this.payAppRepository.findById(input.payApplicationId, organizationId);
    if (!payApp) {
      throw new ServiceError('Pay application not found', 'PAY_APP_NOT_FOUND', 404);
    }

    this.validateStatusTransition(payApp.status, PAY_APP_STATUS.SUBMITTED);

    // Validate before submitting
    const validation = await this.validate(input.payApplicationId);
    if (!validation.canSubmit) {
      throw new ServiceError(
        `Cannot submit pay application: ${validation.errors.map((e) => e.message).join(', ')}`,
        'VALIDATION_FAILED',
        400
      );
    }

    const updated = await this.payAppRepository.updateStatus(
      input.payApplicationId,
      organizationId,
      {
        status: PAY_APP_STATUS.SUBMITTED,
        userId: input.submittedBy,
        notes: input.notes,
      }
    );

    if (!updated) {
      throw new ServiceError('Failed to submit pay application', 'UPDATE_FAILED', 500);
    }

    return this.transformPayApp(updated);
  }

  /**
   * Approve a pay application
   */
  async approve(input: ApprovePayAppInput): Promise<PayAppSummary> {
    const organizationId = this.requireOrganizationContext();

    const payApp = await this.payAppRepository.findById(input.payApplicationId, organizationId);
    if (!payApp) {
      throw new ServiceError('Pay application not found', 'PAY_APP_NOT_FOUND', 404);
    }

    this.validateStatusTransition(payApp.status, PAY_APP_STATUS.APPROVED);

    const updated = await this.payAppRepository.updateStatus(
      input.payApplicationId,
      organizationId,
      {
        status: PAY_APP_STATUS.APPROVED,
        userId: input.approvedBy,
        approvedAmount: input.approvedAmount?.toString(),
        notes: input.notes,
      }
    );

    if (!updated) {
      throw new ServiceError('Failed to approve pay application', 'UPDATE_FAILED', 500);
    }

    return this.transformPayApp(updated);
  }

  /**
   * Reject a pay application
   */
  async reject(input: RejectPayAppInput): Promise<PayAppSummary> {
    const organizationId = this.requireOrganizationContext();

    const payApp = await this.payAppRepository.findById(input.payApplicationId, organizationId);
    if (!payApp) {
      throw new ServiceError('Pay application not found', 'PAY_APP_NOT_FOUND', 404);
    }

    this.validateStatusTransition(payApp.status, PAY_APP_STATUS.REJECTED);

    const updated = await this.payAppRepository.updateStatus(
      input.payApplicationId,
      organizationId,
      {
        status: PAY_APP_STATUS.REJECTED,
        userId: input.rejectedBy,
        reason: input.reason,
      }
    );

    if (!updated) {
      throw new ServiceError('Failed to reject pay application', 'UPDATE_FAILED', 500);
    }

    return this.transformPayApp(updated);
  }

  /**
   * Certify a pay application (architect certification)
   */
  async certify(input: CertifyPayAppInput): Promise<PayAppSummary> {
    const organizationId = this.requireOrganizationContext();

    const payApp = await this.payAppRepository.findById(input.payApplicationId, organizationId);
    if (!payApp) {
      throw new ServiceError('Pay application not found', 'PAY_APP_NOT_FOUND', 404);
    }

    this.validateStatusTransition(payApp.status, PAY_APP_STATUS.CERTIFIED);

    const updated = await this.payAppRepository.updateStatus(
      input.payApplicationId,
      organizationId,
      {
        status: PAY_APP_STATUS.CERTIFIED,
        userId: input.certifiedBy,
        certificationNumber: input.certificationNumber,
        notes: input.notes,
      }
    );

    if (!updated) {
      throw new ServiceError('Failed to certify pay application', 'UPDATE_FAILED', 500);
    }

    return this.transformPayApp(updated);
  }

  /**
   * Mark pay application as billed
   */
  async bill(input: BillPayAppInput): Promise<PayAppSummary> {
    const organizationId = this.requireOrganizationContext();

    const payApp = await this.payAppRepository.findById(input.payApplicationId, organizationId);
    if (!payApp) {
      throw new ServiceError('Pay application not found', 'PAY_APP_NOT_FOUND', 404);
    }

    this.validateStatusTransition(payApp.status, PAY_APP_STATUS.BILLED);

    const updated = await this.payAppRepository.updateStatus(
      input.payApplicationId,
      organizationId,
      {
        status: PAY_APP_STATUS.BILLED,
        userId: input.billedBy,
        invoiceNumber: input.invoiceNumber,
        invoiceDate: input.invoiceDate,
      }
    );

    if (!updated) {
      throw new ServiceError('Failed to bill pay application', 'UPDATE_FAILED', 500);
    }

    // Update SOV billing progress
    await this.updateSovBillingProgress(input.payApplicationId);

    return this.transformPayApp(updated);
  }

  /**
   * Record payment received
   */
  async recordPayment(input: RecordPaymentInput): Promise<PayAppSummary> {
    const organizationId = this.requireOrganizationContext();

    const payApp = await this.payAppRepository.findById(input.payApplicationId, organizationId);
    if (!payApp) {
      throw new ServiceError('Pay application not found', 'PAY_APP_NOT_FOUND', 404);
    }

    this.validateStatusTransition(payApp.status, PAY_APP_STATUS.PAID);

    const updated = await this.payAppRepository.updateStatus(
      input.payApplicationId,
      organizationId,
      {
        status: PAY_APP_STATUS.PAID,
        userId: this.context.userId || '',
        paidAmount: input.paidAmount.toString(),
        paidDate: input.paidDate,
        checkNumber: input.checkNumber,
        paymentReference: input.paymentReference,
        notes: input.notes,
      }
    );

    if (!updated) {
      throw new ServiceError('Failed to record payment', 'UPDATE_FAILED', 500);
    }

    return this.transformPayApp(updated);
  }

  /**
   * Void a pay application
   */
  async void(input: VoidPayAppInput): Promise<PayAppSummary> {
    const organizationId = this.requireOrganizationContext();

    const payApp = await this.payAppRepository.findById(input.payApplicationId, organizationId);
    if (!payApp) {
      throw new ServiceError('Pay application not found', 'PAY_APP_NOT_FOUND', 404);
    }

    this.validateStatusTransition(payApp.status, PAY_APP_STATUS.VOIDED);

    const updated = await this.payAppRepository.updateStatus(
      input.payApplicationId,
      organizationId,
      {
        status: PAY_APP_STATUS.VOIDED,
        userId: input.voidedBy,
        reason: input.reason,
      }
    );

    if (!updated) {
      throw new ServiceError('Failed to void pay application', 'UPDATE_FAILED', 500);
    }

    return this.transformPayApp(updated);
  }

  /**
   * Revert to draft (from rejected)
   */
  async revertToDraft(payApplicationId: string): Promise<PayAppSummary> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const payApp = await this.payAppRepository.findById(payApplicationId, organizationId);
    if (!payApp) {
      throw new ServiceError('Pay application not found', 'PAY_APP_NOT_FOUND', 404);
    }

    this.validateStatusTransition(payApp.status, PAY_APP_STATUS.DRAFT);

    const updated = await this.payAppRepository.updateStatus(
      payApplicationId,
      organizationId,
      {
        status: PAY_APP_STATUS.DRAFT,
        userId,
      }
    );

    if (!updated) {
      throw new ServiceError('Failed to revert pay application', 'UPDATE_FAILED', 500);
    }

    return this.transformPayApp(updated);
  }

  /**
   * Delete a pay application (only DRAFT)
   */
  async delete(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();

    const payApp = await this.payAppRepository.findById(id, organizationId);
    if (!payApp) {
      throw new ServiceError('Pay application not found', 'PAY_APP_NOT_FOUND', 404);
    }

    if (payApp.status !== PAY_APP_STATUS.DRAFT) {
      throw new ServiceError(
        `Cannot delete pay application with status "${payApp.status}". Only DRAFT applications can be deleted.`,
        'PAY_APP_NOT_DELETABLE',
        400
      );
    }

    await this.payAppRepository.delete(id, organizationId);
  }

  // ========== Validation Methods ==========

  /**
   * Validate pay application status transition
   */
  private validateStatusTransition(currentStatus: string, newStatus: PayAppStatus): void {
    const validTransitions = VALID_PAY_APP_STATUS_TRANSITIONS[currentStatus as PayAppStatus];
    if (!validTransitions?.includes(newStatus)) {
      throw new ServiceError(
        `Invalid status transition from "${currentStatus}" to "${newStatus}"`,
        'INVALID_STATUS_TRANSITION',
        400
      );
    }
  }

  /**
   * Validate a pay application
   */
  async validate(payApplicationId: string): Promise<PayAppValidationResult> {
    const organizationId = this.requireOrganizationContext();

    const payApp = await this.payAppRepository.findById(payApplicationId, organizationId);
    if (!payApp) {
      throw new ServiceError('Pay application not found', 'PAY_APP_NOT_FOUND', 404);
    }

    const lines = await this.payAppRepository.findLinesByPayApp(payApplicationId);
    const errors: PayAppValidationError[] = [];
    const warnings: PayAppValidationWarning[] = [];

    // Check that pay app has lines
    if (lines.length === 0) {
      errors.push({
        code: 'NO_LINES',
        message: 'Pay application must have at least one line item',
      });
    }

    // Check for overbilling
    for (const line of lines) {
      const scheduledValue = parseFloat(line.scheduledValue || '0');
      const totalBilled = parseFloat(line.totalCompletedAndStored || '0');

      if (totalBilled > scheduledValue * 1.001) { // Allow small rounding
        warnings.push({
          code: 'OVERBILLING',
          message: `Line ${line.lineNumber} billing (${totalBilled.toFixed(2)}) exceeds scheduled value (${scheduledValue.toFixed(2)})`,
          lineId: line.id,
        });
      }
    }

    // Check for negative values
    for (const line of lines) {
      if (parseFloat(line.thisWorkCompleted || '0') < 0) {
        errors.push({
          code: 'NEGATIVE_VALUE',
          message: `Line ${line.lineNumber} has negative work completed`,
          lineId: line.id,
          field: 'thisWorkCompleted',
        });
      }
      if (parseFloat(line.thisMaterialsStored || '0') < 0) {
        errors.push({
          code: 'NEGATIVE_VALUE',
          message: `Line ${line.lineNumber} has negative materials stored`,
          lineId: line.id,
          field: 'thisMaterialsStored',
        });
      }
    }

    // Check that there's something to bill
    const totalThisPeriod = lines.reduce((sum, line) => {
      return sum + parseFloat(line.thisWorkCompleted || '0') + parseFloat(line.thisMaterialsStored || '0');
    }, 0);

    if (totalThisPeriod === 0) {
      warnings.push({
        code: 'ZERO_BILLING',
        message: 'No billing amounts entered for this period',
      });
    }

    const canSubmit = errors.length === 0 && payApp.status === PAY_APP_STATUS.DRAFT;
    const canApprove = errors.length === 0 && payApp.status === PAY_APP_STATUS.SUBMITTED;
    const canCertify = errors.length === 0 && payApp.status === PAY_APP_STATUS.APPROVED;
    const canBill = errors.length === 0 && payApp.status === PAY_APP_STATUS.CERTIFIED;

    return {
      valid: errors.length === 0,
      canSubmit,
      canApprove,
      canCertify,
      canBill,
      errors,
      warnings,
    };
  }

  /**
   * Validate pay application math
   */
  async validateMath(payApplicationId: string): Promise<PayAppMathValidation> {
    const organizationId = this.requireOrganizationContext();

    const payApp = await this.payAppRepository.findById(payApplicationId, organizationId);
    if (!payApp) {
      throw new ServiceError('Pay application not found', 'PAY_APP_NOT_FOUND', 404);
    }

    const lines = await this.payAppRepository.findLinesByPayApp(payApplicationId);
    const errors: string[] = [];

    // Calculate totals from lines
    let totalScheduledValue = 0;
    let totalPreviousBilling = 0;
    let totalCurrentBilling = 0;
    let calculatedRetainage = 0;

    for (const line of lines) {
      totalScheduledValue += parseFloat(line.scheduledValue || '0');
      totalPreviousBilling += parseFloat(line.previousWorkCompleted || '0') +
        parseFloat(line.previousMaterialsStored || '0');
      const thisTotal = parseFloat(line.thisWorkCompleted || '0') +
        parseFloat(line.thisMaterialsStored || '0');
      totalCurrentBilling += thisTotal;

      const retainagePercent = parseFloat(line.retainagePercent || '10') / 100;
      calculatedRetainage += thisTotal * retainagePercent;
    }

    const totalBilledToDate = totalPreviousBilling + totalCurrentBilling;
    const reportedRetainage = parseFloat(payApp.totalRetainage || '0');
    const retainageDifference = Math.abs(calculatedRetainage - reportedRetainage);

    if (retainageDifference > 0.01) {
      errors.push(`Retainage calculation mismatch: calculated ${calculatedRetainage.toFixed(2)}, reported ${reportedRetainage.toFixed(2)}`);
    }

    const calculatedCurrentDue = totalCurrentBilling - calculatedRetainage;
    const reportedCurrentDue = parseFloat(payApp.currentPaymentDue || '0');
    const currentDueDifference = Math.abs(calculatedCurrentDue - reportedCurrentDue);

    if (currentDueDifference > 0.01) {
      errors.push(`Current due calculation mismatch: calculated ${calculatedCurrentDue.toFixed(2)}, reported ${reportedCurrentDue.toFixed(2)}`);
    }

    return {
      isBalanced: errors.length === 0,
      totalScheduledValue,
      totalPreviousBilling,
      totalCurrentBilling,
      totalBilledToDate,
      calculatedRetainage,
      reportedRetainage,
      retainageDifference,
      calculatedCurrentDue,
      reportedCurrentDue,
      currentDueDifference,
      errors,
    };
  }

  // ========== G702 Export Methods ==========

  /**
   * Generate AIA G702 Application and Certificate for Payment
   */
  async generateG702(payApplicationId: string): Promise<G702Application> {
    const organizationId = this.requireOrganizationContext();

    const payApp = await this.payAppRepository.findById(payApplicationId, organizationId);
    if (!payApp) {
      throw new ServiceError('Pay application not found', 'PAY_APP_NOT_FOUND', 404);
    }

    const sov = await this.sovRepository.findById(payApp.scheduleOfValuesId, organizationId);
    if (!sov) {
      throw new ServiceError('SOV not found', 'SOV_NOT_FOUND', 404);
    }

    // Get previous certificates total
    const previousTotals = await this.payAppRepository.calculatePreviousBillingTotals(
      payApp.scheduleOfValuesId,
      payApplicationId
    );

    const retainageFromWork = parseFloat(payApp.retainageFromWorkCompleted || '0');
    const retainageFromMaterial = parseFloat(payApp.retainageFromStoredMaterial || '0');
    const totalRetainage = parseFloat(payApp.totalRetainage || '0');
    const totalCompletedAndStored = parseFloat(payApp.totalCompletedAndStoredToDate || '0');
    const totalEarnedLessRetainage = totalCompletedAndStored - totalRetainage;
    const lessPreviousCertificates = parseFloat(previousTotals.totalPreviousCertificates || '0');
    const currentPaymentDue = totalEarnedLessRetainage - lessPreviousCertificates;
    const contractSumToDate = parseFloat(sov.revisedContractAmount || '0');
    const balanceToFinish = contractSumToDate - totalCompletedAndStored;

    return {
      projectName: '', // Would be populated from project lookup
      projectNumber: '',
      contractDate: '', // Contract date would come from project/contract lookup
      applicationNumber: payApp.applicationNumber,
      periodTo: payApp.periodTo,
      distributionTo: [],
      contractor: {
        name: '',
        address: '',
      },
      owner: {
        name: '',
        address: '',
      },
      architect: {
        name: '',
        address: '',
      },
      contractSummary: {
        originalContractSum: parseFloat(sov.originalContractAmount || '0'),
        netChangeByChangeOrders: parseFloat(sov.approvedChangeOrders || '0'),
        contractSumToDate,
        totalCompletedAndStoredToDate: totalCompletedAndStored,
        retainage: {
          fromCompletedWork: retainageFromWork,
          fromStoredMaterial: retainageFromMaterial,
          total: totalRetainage,
        },
        totalEarnedLessRetainage,
        lessPreviousCertificates,
        currentPaymentDue,
        balanceToFinish,
      },
      changeOrderSummary: {
        additions: 0, // Would be calculated from change orders
        deductions: 0,
        netChanges: parseFloat(sov.approvedChangeOrders || '0'),
      },
      certification: payApp.certifiedDate
        ? {
            certifiedBy: payApp.certifiedBy || '',
            certifiedDate: payApp.certifiedDate instanceof Date
              ? payApp.certifiedDate.toISOString()
              : payApp.certifiedDate || '',
            certificationNumber: payApp.certificationNumber,
          }
        : undefined,
    };
  }

  // ========== Approval History Methods ==========

  /**
   * Get approval history for a pay application
   */
  async getApprovalHistory(payApplicationId: string) {
    const organizationId = this.requireOrganizationContext();

    const payApp = await this.payAppRepository.findById(payApplicationId, organizationId);
    if (!payApp) {
      throw new ServiceError('Pay application not found', 'PAY_APP_NOT_FOUND', 404);
    }

    return this.payAppRepository.getApprovalHistory(payApplicationId);
  }

  // ========== Retainage Release Methods ==========

  /**
   * Create a retainage release
   */
  async createRetainageRelease(input: CreateRetainageReleaseInput): Promise<RetainageReleaseSummary> {
    const organizationId = input.organizationId || this.requireOrganizationContext();
    const userId = this.context.userId;

    // Get next release number
    const releaseNumber = await this.payAppRepository.getNextReleaseNumber(
      input.projectId,
      organizationId
    );

    const created = await this.payAppRepository.createRetainageRelease({
      organizationId,
      projectId: input.projectId,
      payApplicationId: input.payApplicationId,
      releaseNumber,
      releaseDate: input.releaseDate,
      releaseType: input.releaseType,
      releaseAmount: input.releaseAmount.toString(),
      releasePercent: input.releasePercent?.toString(),
      requiresPunchlistComplete: input.requiresPunchlistComplete,
      requiresLienWaivers: input.requiresLienWaivers,
      requiresWarrantyDocuments: input.requiresWarrantyDocuments,
      externalReference: input.externalReference,
      notes: input.notes,
      requestedBy: userId,
    });

    return {
      id: created.id,
      releaseNumber: created.releaseNumber,
      releaseDate: created.releaseDate,
      releaseType: created.releaseType || 'PARTIAL',
      status: created.status,
      projectId: created.projectId,
      projectName: '',
      payApplicationId: created.payApplicationId,
      totalRetainageHeld: parseFloat(created.totalRetainageHeld || '0'),
      releaseAmount: parseFloat(created.releaseAmount || '0'),
      retainageRemaining: parseFloat(created.retainageRemaining || '0'),
      releasePercent: created.releasePercent ? parseFloat(created.releasePercent) : undefined,
      requiresPunchlistComplete: created.requiresPunchlistComplete || false,
      requiresLienWaivers: created.requiresLienWaivers || false,
      requiresWarrantyDocuments: created.requiresWarrantyDocuments || false,
    };
  }

  /**
   * Approve a retainage release
   */
  async approveRetainageRelease(input: ApproveRetainageReleaseInput): Promise<RetainageReleaseSummary> {
    const organizationId = this.requireOrganizationContext();

    const release = await this.payAppRepository.findRetainageReleaseById(
      input.retainageReleaseId,
      organizationId
    );
    if (!release) {
      throw new ServiceError('Retainage release not found', 'RELEASE_NOT_FOUND', 404);
    }

    const updated = await this.payAppRepository.updateRetainageReleaseStatus(
      input.retainageReleaseId,
      organizationId,
      'APPROVED',
      input.approvedBy,
      { approvedAmount: input.approvedAmount?.toString() }
    );

    if (!updated) {
      throw new ServiceError('Failed to approve retainage release', 'UPDATE_FAILED', 500);
    }

    return {
      id: updated.id,
      releaseNumber: updated.releaseNumber,
      releaseDate: updated.releaseDate,
      releaseType: updated.releaseType || 'PARTIAL',
      status: updated.status,
      projectId: updated.projectId,
      projectName: '',
      totalRetainageHeld: parseFloat(updated.totalRetainageHeld || '0'),
      releaseAmount: parseFloat(updated.releaseAmount || '0'),
      retainageRemaining: parseFloat(updated.retainageRemaining || '0'),
      requiresPunchlistComplete: updated.requiresPunchlistComplete || false,
      requiresLienWaivers: updated.requiresLienWaivers || false,
      requiresWarrantyDocuments: updated.requiresWarrantyDocuments || false,
    };
  }

  /**
   * Get retainage releases for a project
   */
  async getRetainageReleases(projectId: string): Promise<RetainageReleaseSummary[]> {
    const organizationId = this.requireOrganizationContext();

    const releases = await this.payAppRepository.findRetainageReleasesByProject(
      projectId,
      organizationId
    );

    return releases.map((release) => ({
      id: release.id,
      releaseNumber: release.releaseNumber,
      releaseDate: release.releaseDate,
      releaseType: release.releaseType || 'PARTIAL',
      status: release.status,
      projectId: release.projectId,
      projectName: '',
      payApplicationId: release.payApplicationId,
      totalRetainageHeld: parseFloat(release.totalRetainageHeld || '0'),
      releaseAmount: parseFloat(release.releaseAmount || '0'),
      retainageRemaining: parseFloat(release.retainageRemaining || '0'),
      requiresPunchlistComplete: release.requiresPunchlistComplete || false,
      requiresLienWaivers: release.requiresLienWaivers || false,
      requiresWarrantyDocuments: release.requiresWarrantyDocuments || false,
    }));
  }

  // ========== Helper Methods ==========

  /**
   * Update SOV billing progress from pay app
   */
  private async updateSovBillingProgress(payApplicationId: string): Promise<void> {
    const linesWithSov = await this.payAppRepository.findLinesWithSovDetails(payApplicationId);

    for (const { line, sovLine } of linesWithSov) {
      const previousWorkCompleted = parseFloat(sovLine.previousWorkCompleted || '0');
      const previousMaterialsStored = parseFloat(sovLine.previousMaterialsStored || '0');
      const thisWorkCompleted = parseFloat(line.thisWorkCompleted || '0');
      const thisMaterialsStored = parseFloat(line.thisMaterialsStored || '0');

      const newPreviousWorkCompleted = previousWorkCompleted + thisWorkCompleted;
      const newPreviousMaterialsStored = previousMaterialsStored + thisMaterialsStored;
      const totalCompletedAndStored = newPreviousWorkCompleted + newPreviousMaterialsStored;
      const scheduledValue = parseFloat(sovLine.revisedScheduledValue || '0');
      const percentComplete = scheduledValue > 0
        ? (totalCompletedAndStored / scheduledValue) * 100
        : 0;
      const balanceToFinish = scheduledValue - totalCompletedAndStored;

      await this.sovRepository.updateLineBillingProgress(sovLine.id, {
        previousWorkCompleted: newPreviousWorkCompleted.toString(),
        previousMaterialsStored: newPreviousMaterialsStored.toString(),
        currentWorkCompleted: '0', // Reset current for next pay app
        currentMaterialsStored: '0',
        totalCompletedAndStored: totalCompletedAndStored.toString(),
        percentComplete: percentComplete.toFixed(4),
        balanceToFinish: balanceToFinish.toString(),
      });
    }

    // Recalculate SOV totals
    const payApp = await this.payAppRepository.findLineById(payApplicationId);
    if (payApp) {
      // Get the SOV ID from the pay app
      const payAppData = await this.payAppRepository.findById(payApplicationId, this.requireOrganizationContext());
      if (payAppData) {
        await this.sovRepository.recalculateTotals(payAppData.scheduleOfValuesId);
      }
    }
  }
}
