# API Architecture, Contracts, Testing & Monorepo Structure

## API Contracts and Specifications

### 1. Contracts API

```typescript
// POST /api/contracts
interface CreateContractRequest {
  contract_number: string;
  customer_id: string;
  contract_date: string; // ISO 8601
  effective_date: string; // ISO 8601
  contract_value: number;
  line_items: ContractLineItemInput[];
  ssp_allocation_method: 'observable_evidence' | 'residual' | 'proportional';
}

interface ContractLineItemInput {
  product_id: string;
  description?: string;
  quantity: number;
  list_price: number;
  discount_percent?: number;
  total_price: number;
  ssp?: number;
}

interface CreateContractResponse {
  contract_id: string;
  allocation_summary: AllocationSummary;
  performance_obligations: PerformanceObligation[];
  initial_schedules: RevenueScheduleItem[];
}

// GET /api/contracts/{contractId}
interface GetContractResponse {
  contract: Contract;
  line_items: ContractLineItem[];
  performance_obligations: PerformanceObligation[];
  ssp_allocations: ContractSspAllocation[];
}

// PUT /api/contracts/{contractId}
interface UpdateContractRequest {
  contract_status?: ContractStatus;
  line_items?: ContractLineItemInput[];
  ssp_allocation_method?: 'observable_evidence' | 'residual' | 'proportional';
}
```

### 2. Revenue Recognition API

```typescript
// POST /api/revenue/recognize
interface RecognizeRevenueRequest {
  contract_id?: string;
  performance_obligation_id?: string;
  recognition_date: string; // ISO 8601
  recognition_method: 'automatic' | 'manual' | 'milestone';
  amount?: number; // For manual recognition
  milestone_id?: string; // For milestone-based
}

interface RecognizeRevenueResponse {
  recognized_entries: RevenueJournalEntry[];
  updated_schedules: RevenueScheduleItem[];
  remaining_deferred: number;
}

// GET /api/revenue/schedules
interface GetRevenueSchedulesRequest {
  start_date: string;
  end_date: string;
  contract_id?: string;
  customer_id?: string;
  status?: 'scheduled' | 'recognized' | 'pending';
}

interface GetRevenueSchedulesResponse {
  schedules: RevenueScheduleItem[];
  summary: RevenueSummary;
  pagination: PaginationInfo;
}

// POST /api/revenue/adjustments
interface CreateRevenueAdjustmentRequest {
  performance_obligation_id: string;
  adjustment_type: 'change_in_estimate' | 'correction' | 'modification';
  schedule_date: string;
  amount: number;
  reason: string;
}
```

### 3. SSP Management API

```typescript
// POST /api/ssp/products/{productId}
interface UpdateProductSspRequest {
  ssp: number;
  evidence_type: 'customer_pricing' | 'comparable_sales' | 'market_research' | 'cost_plus';
  evidence_date: string;
  confidence_level: 'high' | 'medium' | 'low';
  notes?: string;
}

interface UpdateProductSspResponse {
  updated_ssp: number;
  affected_contracts: string[]; // Contract IDs requiring reallocation
  ssp_history: SspEvidence[];
}

// POST /api/ssp/reallocate
interface ReallocateSspRequest {
  contract_id: string;
  trigger_reason: 'ssp_change' | 'modification' | 'manual';
  effective_date: string;
}

interface ReallocateSspResponse {
  new_allocations: ContractSspAllocation[];
  impact_summary: AllocationChangeImpact;
  affected_schedules: RevenueScheduleItem[];
}
```

### 4. Reporting API

```typescript
// GET /api/reports/waterfall
interface GetWaterfallReportRequest {
  contract_id?: string;
  customer_id?: string;
  start_date?: string;
  end_date?: string;
}

interface GetWaterfallReportResponse {
  waterfall_data: WaterfallReportItem[];
  summary: WaterfallSummary;
}

// GET /api/reports/revenue-schedule
interface GetRevenueScheduleReportRequest {
  period_type: 'monthly' | 'quarterly' | 'yearly';
  start_date: string;
  end_date: string;
  customer_id?: string;
  product_id?: string;
}

// POST /api/reports/custom
interface CreateCustomReportRequest {
  report_type: 'revenue_analysis' | 'ssp_tracking' | 'performance_obligation_status';
  filters: Record<string, any>;
  group_by: string[];
  metrics: string[];
  date_range: {
    start_date: string;
    end_date: string;
  };
}
```

## Lambda Function Implementation

### Contract Processing Lambda

```typescript
// packages/lambdas/contract-processor/src/index.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ContractService } from './services/ContractService';
import { validateRequest } from './middleware/validation';
import { CreateContractRequest, CreateContractResponse } from './types';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Validate request
    const request = validateRequest<CreateContractRequest>(event.body);
    
    // Process contract
    const contractService = new ContractService();
    const result = await contractService.createContract(request);
    
    // Return response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Error processing contract:', error);
    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({
        error: error.message || 'Internal server error'
      })
    };
  }
};

// packages/lambdas/contract-processor/src/services/ContractService.ts
export class ContractService {
  private readonly supabase: SupabaseClient;
  private readonly sspService: SspService;
  private readonly scheduleService: ScheduleService;
  
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_KEY!
    );
    this.sspService = new SspService(this.supabase);
    this.scheduleService = new ScheduleService(this.supabase);
  }
  
  async createContract(request: CreateContractRequest): Promise<CreateContractResponse> {
    // 1. Create contract record
    const contract = await this.createContractRecord(request);
    
    // 2. Create line items
    const lineItems = await this.createLineItems(contract.id, request.line_items);
    
    // 3. Allocate SSP
    const allocations = await this.sspService.allocateTransactionPrice(
      contract.id,
      lineItems,
      request.ssp_allocation_method
    );
    
    // 4. Create performance obligations
    const obligations = await this.createPerformanceObligations(
      contract.id,
      lineItems,
      allocations
    );
    
    // 5. Generate initial schedules
    const schedules = await this.scheduleService.generateInitialSchedules(obligations);
    
    return {
      contract_id: contract.id,
      allocation_summary: allocations,
      performance_obligations: obligations,
      initial_schedules: schedules
    };
  }
}
```

### Revenue Recognition Lambda

```typescript
// packages/lambdas/revenue-recognizer/src/index.ts
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const request = validateRequest<RecognizeRevenueRequest>(event.body);
    
    const revenueService = new RevenueService();
    const result = await revenueService.recognizeRevenue(request);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Error recognizing revenue:', error);
    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({
        error: error.message || 'Internal server error'
      })
    };
  }
};

// packages/lambdas/revenue-recognizer/src/services/RevenueService.ts
export class RevenueService {
  async recognizeRevenue(
    request: RecognizeRevenueRequest
  ): Promise<RecognizeRevenueResponse> {
    // 1. Get performance obligations to recognize
    const obligations = await this.getPerformanceObligations(request);
    
    // 2. Calculate recognition amounts
    const recognitionAmounts = await this.calculateRecognitionAmounts(obligations, request);
    
    // 3. Create journal entries
    const journalEntries = await this.createJournalEntries(recognitionAmounts);
    
    // 4. Update revenue schedules
    const updatedSchedules = await this.updateRevenueSchedules(obligations, request);
    
    // 5. Calculate remaining deferred revenue
    const remainingDeferred = await this.calculateRemainingDeferred(obligations);
    
    return {
      recognized_entries: journalEntries,
      updated_schedules: updatedSchedules,
      remaining_deferred: remainingDeferred
    };
  }
}
```

## Testing Strategy

### 1. Unit Tests

```typescript
// packages/lambdas/contract-processor/tests/unit/ContractService.test.ts
import { ContractService } from '../src/services/ContractService';
import { createMockSupabaseClient } from '../mocks/supabase';

describe('ContractService', () => {
  let service: ContractService;
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    service = new ContractService(mockSupabase);
  });

  describe('createContract', () => {
    it('should create contract with proper SSP allocation', async () => {
      const request: CreateContractRequest = {
        contract_number: 'TEST-001',
        customer_id: 'customer-123',
        contract_date: '2025-01-01',
        effective_date: '2025-01-01',
        contract_value: 100000,
        line_items: [
          {
            product_id: 'product-1',
            quantity: 1,
            list_price: 60000,
            total_price: 60000,
            ssp: 50000
          },
          {
            product_id: 'product-2',
            quantity: 1,
            list_price: 40000,
            total_price: 40000,
            ssp: 35000
          }
        ],
        ssp_allocation_method: 'proportional'
      };

      const result = await service.createContract(request);

      expect(result.contract_id).toBeDefined();
      expect(result.allocation_summary.total_allocated).toBe(100000);
      expect(result.performance_obligations).toHaveLength(2);
    });
  });
});

// packages/shared/testing/jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

### 2. Integration Tests

```typescript
// packages/lambdas/contract-processor/tests/integration/contract-flow.test.ts
describe('Contract Flow Integration', () => {
  let testClient: SupabaseClient;
  
  beforeAll(async () => {
    testClient = createClient(
      process.env.TEST_SUPABASE_URL!,
      process.env.TEST_SUPABASE_KEY!
    );
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  it('should complete full contract creation and revenue recognition flow', async () => {
    // 1. Create contract
    const contract = await createTestContract();
    
    // 2. Verify SSP allocation
    const allocations = await verifyAllocations(contract.id);
    
    // 3. Recognize revenue
    const recognition = await recognizeMonthlyRevenue(contract.id);
    
    // 4. Verify journal entries
    const entries = await verifyJournalEntries(contract.id);
    
    expect(entries).toHaveLength(4); // Debit/Credit pairs
    expect(recognition.remaining_deferred).toBeGreaterThan(0);
  });
});
```

### 3. E2E Tests

```typescript
// packages/web/tests/e2e/contract-creation.test.ts
import { test, expect } from '@playwright/test';

test.describe('Contract Creation Flow', () => {
  test('should create contract and view waterfall report', async ({ page }) => {
    // Navigate to contracts page
    await page.goto('/contracts/new');
    
    // Fill contract details
    await page.fill('#contract-number', 'TEST-001');
    await page.fill('#customer-select', 'Test Customer');
    
    // Add line items
    await page.click('#add-line-item');
    await page.fill('#line-item-0-product', 'Software License');
    await page.fill('#line-item-0-price', '50000');
    
    // Submit form
    await page.click('#submit-contract');
    
    // Verify success
    await expect(page.locator('.success-message')).toBeVisible();
    
    // Navigate to waterfall report
    const contractId = await page.locator('#contract-id').innerText();
    await page.goto(`/contracts/${contractId}/waterfall`);
    
    // Verify waterfall data
    await expect(page.locator('.waterfall-table')).toBeVisible();
    await expect(page.locator('.allocation-row')).toHaveCount(2);
  });
});
```

## Monorepo Structure

```
revenue-recognition-system/
├── package.json
├── turbo.json
├── prettier.config.js
├── tsconfig.json
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── packages/
│   ├── web/                    # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   └── types/
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   ├── integration/
│   │   │   └── e2e/
│   │   ├── public/
│   │   ├── package.json
│   │   ├── next.config.js
│   │   └── tsconfig.json
│   │
│   ├── lambdas/               # Lambda functions
│   │   ├── contract-processor/
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── services/
│   │   │   │   ├── middleware/
│   │   │   │   └── types/
│   │   │   ├── tests/
│   │   │   ├── package.json
│   │   │   └── serverless.yml
│   │   ├── revenue-recognizer/
│   │   ├── ssp-manager/
│   │   ├── reporting-service/
│   │   └── scheduled-jobs/
│   │
│   ├── database/              # Database schema and migrations
│   │   ├── migrations/
│   │   ├── seeds/
│   │   ├── types/
│   │   └── scripts/
│   │
│   └── shared/                # Shared libraries
│       ├── types/
│       │   ├── contracts.ts
│       │   ├── revenue.ts
│       │   └── api.ts
│       ├── utils/
│       │   ├── validation.ts
│       │   ├── calculations.ts
│       │   └── formatting.ts
│       ├── testing/
│       │   ├── mocks/
│       │   ├── fixtures/
│       │   └── jest.config.js
│       └── schemas/
│           ├── api/
│           └── database/
│
├── infrastructure/            # IaC files
│   ├── terraform/
│   │   ├── environments/
│   │   ├── modules/
│   │   └── main.tf
│   └── cloudformation/
│
├── scripts/
│   ├── setup.sh
│   ├── deploy.sh
│   └── test.sh
│
└── docs/
    ├── api/
    ├── architecture/
    └── deployment/
```

### Package.json Configuration

```json
{
  "name": "revenue-recognition-system",
  "private": true,
  "workspaces": [
    "packages/*",
    "packages/lambdas/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "test:e2e": "turbo run test:e2e",
    "lint": "turbo run lint",
    "deploy": "turbo run deploy",
    "db:migrate": "cd packages/database && npm run migrate",
    "db:seed": "cd packages/database && npm run seed"
  },
  "devDependencies": {
    "@types/node": "^18.0.0",
    "prettier": "^2.8.0",
    "turbo": "^1.10.0",
    "typescript": "^5.0.0"
  }
}
```

### Turbo Configuration

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "inputs": ["src/**/*.ts", "tests/**/*.ts"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "outputs": []
    },
    "deploy": {
      "dependsOn": ["build", "test"]
    }
  }
}
```

## Key Testing Strategies

1. **Unit Tests**: Test individual functions and services in isolation
2. **Integration Tests**: Test API endpoints and database operations
3. **E2E Tests**: Test complete user workflows
4. **Performance Tests**: Test system under load
5. **Contract Tests**: Validate API contract compliance
6. **Snapshot Tests**: Ensure UI consistency

This architecture provides a robust foundation for developing, testing, and deploying your revenue recognition system as a monorepo, with clear separation of concerns and comprehensive testing coverage.