import { v4 as uuidv4 } from 'uuid';
import {
  organizations,
  entities,
  items,
  kitComponents,
  subscriptions,
  subscriptionItems,
  performanceObligations,
  revenueSchedules,
  invoices,
  invoiceLineItems,
  payments
} from '@glapi/database';

export interface KitComponent {
  componentItemId: string;
  quantity: number;
  allocationPercentage: number;
}

export class TestDataGenerator {
  constructor(private db: any) {}

  async createOrganization(name = 'Test Organization'): Promise<any> {
    const [organization] = await this.db
      .insert(organizations)
      .values({
        id: uuidv4(),
        name,
        slug: `test-org-${Date.now()}`,
        subscriptionStatus: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    return organization;
  }

  async createCustomer(organizationId: string, name?: string): Promise<any> {
    const [customer] = await this.db
      .insert(entities)
      .values({
        id: uuidv4(),
        organizationId,
        entityType: 'customer',
        companyName: name || `Test Customer ${Date.now()}`,
        contactEmail: `customer-${Date.now()}@test.com`,
        contactPhone: '555-0100',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        postalCode: '12345',
        country: 'US',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    return customer;
  }

  async createSoftwareLicenseItem(organizationId: string): Promise<string> {
    const [item] = await this.db
      .insert(items)
      .values({
        id: uuidv4(),
        organizationId,
        itemNumber: `SW-${Date.now()}`,
        displayName: 'Software License',
        description: 'Annual software license',
        itemType: 'non_inventory',
        category: 'software',
        isActive: true,
        defaultPrice: '12000',
        revenueRecognitionPattern: 'point_in_time',
        performanceObligationType: 'product_license',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    return item.id;
  }

  async createMaintenanceItem(organizationId: string): Promise<string> {
    const [item] = await this.db
      .insert(items)
      .values({
        id: uuidv4(),
        organizationId,
        itemNumber: `MAINT-${Date.now()}`,
        displayName: 'Maintenance & Support',
        description: 'Annual maintenance and support',
        itemType: 'service',
        category: 'support',
        isActive: true,
        defaultPrice: '2400',
        revenueRecognitionPattern: 'over_time',
        performanceObligationType: 'maintenance_support',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    return item.id;
  }

  async createKitItem(
    organizationId: string,
    components: KitComponent[]
  ): Promise<string> {
    const [kitItem] = await this.db
      .insert(items)
      .values({
        id: uuidv4(),
        organizationId,
        itemNumber: `KIT-${Date.now()}`,
        displayName: 'Software Bundle',
        description: 'Complete software bundle with support',
        itemType: 'kit',
        category: 'bundle',
        isActive: true,
        defaultPrice: '15000',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    // Create kit components
    for (const component of components) {
      await this.db
        .insert(kitComponents)
        .values({
          id: uuidv4(),
          organizationId,
          parentItemId: kitItem.id,
          componentItemId: component.componentItemId,
          quantity: component.quantity.toString(),
          allocationPercentage: component.allocationPercentage.toString(),
          createdAt: new Date(),
          updatedAt: new Date()
        });
    }
    
    return kitItem.id;
  }

  async createSubscription(
    organizationId: string,
    customerId: string,
    itemsData: Array<{ itemId: string; quantity: number; unitPrice: number }>
  ): Promise<any> {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-12-31');
    const contractValue = itemsData.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    const [subscription] = await this.db
      .insert(subscriptions)
      .values({
        id: uuidv4(),
        organizationId,
        entityId: customerId,
        subscriptionNumber: `SUB-${Date.now()}`,
        status: 'draft',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        contractValue: contractValue.toString(),
        billingFrequency: 'annual',
        paymentTerms: 'net_30',
        autoRenew: false,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    // Create subscription items
    for (const itemData of itemsData) {
      await this.db
        .insert(subscriptionItems)
        .values({
          id: uuidv4(),
          subscriptionId: subscription.id,
          itemId: itemData.itemId,
          quantity: itemData.quantity.toString(),
          unitPrice: itemData.unitPrice.toString(),
          totalPrice: (itemData.quantity * itemData.unitPrice).toString(),
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          createdAt: new Date(),
          updatedAt: new Date()
        });
    }
    
    return subscription;
  }

  async createManySubscriptions(count: number): Promise<string[]> {
    const subscriptionIds: string[] = [];
    const organization = await this.createOrganization();
    
    for (let i = 0; i < count; i++) {
      const customer = await this.createCustomer(organization.id);
      const itemId = await this.createSoftwareLicenseItem(organization.id);
      const unitPrice = Math.floor(Math.random() * 50000) + 10000; // Random value between 10K-60K
      
      const subscription = await this.createSubscription(
        organization.id,
        customer.id,
        [{ itemId, quantity: 1, unitPrice }]
      );
      
      subscriptionIds.push(subscription.id);
    }
    
    return subscriptionIds;
  }

  async createManyRevenueSchedules(count: number): Promise<any[]> {
    const organization = await this.createOrganization();
    const customer = await this.createCustomer(organization.id);
    const itemId = await this.createSoftwareLicenseItem(organization.id);
    
    // Create subscription
    const subscription = await this.createSubscription(
      organization.id,
      customer.id,
      [{ itemId, quantity: 1, unitPrice: 120000 }]
    );
    
    // Create performance obligation
    const [obligation] = await this.db
      .insert(performanceObligations)
      .values({
        id: uuidv4(),
        subscriptionId: subscription.id,
        obligationType: 'maintenance_support',
        obligationName: 'Annual Support',
        satisfactionMethod: 'over_time',
        transactionPrice: '120000',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    // Create revenue schedules
    const schedules = [];
    const monthlyAmount = 10000; // $120k / 12 months
    
    for (let i = 0; i < count; i++) {
      const month = i % 12; // Cycle through months
      const year = 2024 + Math.floor(i / 12);
      const periodStart = new Date(year, month, 1);
      const periodEnd = new Date(year, month + 1, 0);
      
      const [schedule] = await this.db
        .insert(revenueSchedules)
        .values({
          id: uuidv4(),
          organizationId: organization.id,
          performanceObligationId: obligation.id,
          periodStartDate: periodStart.toISOString().split('T')[0],
          periodEndDate: periodEnd.toISOString().split('T')[0],
          scheduledAmount: monthlyAmount.toString(),
          recognizedAmount: '0',
          status: 'scheduled',
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      schedules.push(schedule);
    }
    
    return schedules;
  }

  async createInvoice(
    subscriptionId: string,
    organizationId: string,
    customerId: string,
    amount: number
  ): Promise<any> {
    const [invoice] = await this.db
      .insert(invoices)
      .values({
        id: uuidv4(),
        organizationId,
        entityId: customerId,
        subscriptionId,
        invoiceNumber: `INV-${Date.now()}`,
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'draft',
        subtotal: amount.toString(),
        taxAmount: '0',
        totalAmount: amount.toString(),
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    return invoice;
  }

  async createPayment(
    invoiceId: string,
    organizationId: string,
    amount: number
  ): Promise<any> {
    const [payment] = await this.db
      .insert(payments)
      .values({
        id: uuidv4(),
        organizationId,
        invoiceId,
        paymentDate: new Date().toISOString().split('T')[0],
        amount: amount.toString(),
        paymentMethod: 'bank_transfer',
        referenceNumber: `PAY-${Date.now()}`,
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    return payment;
  }

  // Helper to create complete test scenario
  async createCompleteScenario(): Promise<{
    organization: any;
    customer: any;
    subscription: any;
    items: string[];
  }> {
    const organization = await this.createOrganization('Complete Test Org');
    const customer = await this.createCustomer(organization.id, 'Complete Test Customer');
    
    const licenseItemId = await this.createSoftwareLicenseItem(organization.id);
    const maintenanceItemId = await this.createMaintenanceItem(organization.id);
    
    const subscription = await this.createSubscription(
      organization.id,
      customer.id,
      [
        { itemId: licenseItemId, quantity: 1, unitPrice: 12000 },
        { itemId: maintenanceItemId, quantity: 1, unitPrice: 2400 }
      ]
    );
    
    return {
      organization,
      customer,
      subscription,
      items: [licenseItemId, maintenanceItemId]
    };
  }
}