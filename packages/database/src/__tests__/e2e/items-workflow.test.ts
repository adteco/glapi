import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { db } from '../../db';
import { 
  unitsOfMeasureRepository,
  itemCategoriesRepository,
  itemsRepository,
  pricingRepository,
  vendorItemsRepository,
  assembliesKitsRepository,
  inventoryTrackingRepository,
} from '../../repositories';
import { accounts, entities } from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('Items System E2E Workflow', () => {
  const testOrganizationId = 'e2e-test-org';
  const testUserId = 'e2e-test-user';
  let cleanupIds = {
    accounts: [] as string[],
    entities: [] as string[],
  };

  beforeAll(async () => {
    // Setup GL accounts
    const glAccounts = [
      { code: 'INCOME-001', name: 'Sales Income', accountType: 'Income' },
      { code: 'ASSET-001', name: 'Inventory Asset', accountType: 'Asset' },
      { code: 'COGS-001', name: 'Cost of Goods Sold', accountType: 'Expense' },
      { code: 'EXPENSE-001', name: 'Operating Expense', accountType: 'Expense' },
    ];

    for (const account of glAccounts) {
      const created = await db.insert(accounts).values({
        organizationId: testOrganizationId,
        ...account,
        normalBalance: account.accountType === 'Asset' || account.accountType === 'Expense' ? 'Debit' : 'Credit',
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      }).returning();
      cleanupIds.accounts.push(created[0].id);
    }

    // Setup vendor and customer entities
    const entitiesData = [
      { entityType: 'Vendor', companyName: 'Test Vendor Inc' },
      { entityType: 'Customer', companyName: 'Test Customer LLC' },
    ];

    for (const entity of entitiesData) {
      const created = await db.insert(entities).values({
        organizationId: testOrganizationId,
        ...entity,
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      }).returning();
      cleanupIds.entities.push(created[0].id);
    }
  });

  afterAll(async () => {
    // Cleanup all test data
    for (const id of cleanupIds.accounts) {
      await db.delete(accounts).where(eq(accounts.id, id));
    }
    for (const id of cleanupIds.entities) {
      await db.delete(entities).where(eq(entities.id, id));
    }
  });

  describe('Complete Item Lifecycle', () => {
    it('should handle full item workflow from creation to tracking', async () => {
      // Step 1: Create units of measure
      const eachUnit = await unitsOfMeasureRepository.create({
        organizationId: testOrganizationId,
        code: 'EA',
        name: 'Each',
        abbreviation: 'ea',
        baseConversionFactor: '1',
        decimalPlaces: 0,
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });

      const boxUnit = await unitsOfMeasureRepository.create({
        organizationId: testOrganizationId,
        code: 'BOX',
        name: 'Box',
        abbreviation: 'box',
        baseUnitId: eachUnit.id,
        baseConversionFactor: '12', // 1 box = 12 each
        decimalPlaces: 0,
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });

      // Verify unit conversion
      const conversionFactor = await unitsOfMeasureRepository.calculateConversion(
        boxUnit.id,
        eachUnit.id,
        testOrganizationId
      );
      expect(conversionFactor).toBe(12);

      // Step 2: Create category hierarchy
      const electronicsCategory = await itemCategoriesRepository.create({
        organizationId: testOrganizationId,
        code: 'ELECTRONICS',
        name: 'Electronics',
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });

      const computersCategory = await itemCategoriesRepository.create({
        organizationId: testOrganizationId,
        code: 'COMPUTERS',
        name: 'Computers',
        parentCategoryId: electronicsCategory.id,
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });

      // Verify category hierarchy
      const categoryTree = await itemCategoriesRepository.getCategoryTree(testOrganizationId);
      expect(categoryTree).toHaveLength(1);
      expect(categoryTree[0].children).toHaveLength(1);

      // Step 3: Create a parent item with variants
      const laptopParent = await itemsRepository.create({
        organizationId: testOrganizationId,
        itemCode: 'LAPTOP',
        name: 'Laptop Computer',
        description: 'High-performance laptop',
        itemType: 'INVENTORY_ITEM',
        isParent: true,
        categoryId: computersCategory.id,
        unitOfMeasureId: eachUnit.id,
        incomeAccountId: cleanupIds.accounts[0],
        assetAccountId: cleanupIds.accounts[1],
        cogsAccountId: cleanupIds.accounts[2],
        defaultPrice: '1000.00',
        defaultCost: '600.00',
        isTaxable: true,
        isActive: true,
        isPurchasable: true,
        isSaleable: true,
        trackQuantity: true,
        trackSerialNumbers: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });

      // Generate variants
      const variants = await itemsRepository.generateVariants(
        laptopParent.id,
        testOrganizationId,
        {
          size: ['13-inch', '15-inch'],
          memory: ['8GB', '16GB'],
        }
      );

      expect(variants).toHaveLength(4);
      const variantCodes = variants.map(v => v.itemCode).sort();
      expect(variantCodes).toEqual([
        'LAPTOP-13-inch-8GB',
        'LAPTOP-13-inch-16GB',
        'LAPTOP-15-inch-8GB',
        'LAPTOP-15-inch-16GB',
      ]);

      // Step 4: Create price lists and pricing
      const retailPriceList = await pricingRepository.createPriceList({
        organizationId: testOrganizationId,
        name: 'Retail Price List',
        code: 'RETAIL',
        currencyCode: 'USD',
        isDefault: true,
        isActive: true,
      });

      const wholesalePriceList = await pricingRepository.createPriceList({
        organizationId: testOrganizationId,
        name: 'Wholesale Price List',
        code: 'WHOLESALE',
        currencyCode: 'USD',
        isDefault: false,
        isActive: true,
      });

      // Add pricing for variants
      for (const variant of variants) {
        const basePrice = variant.itemCode.includes('16GB') ? 1200 : 1000;
        const sizeMultiplier = variant.itemCode.includes('15-inch') ? 1.2 : 1;
        
        // Retail pricing
        await pricingRepository.createItemPricing({
          itemId: variant.id,
          priceListId: retailPriceList.id,
          unitPrice: (basePrice * sizeMultiplier).toString(),
          minQuantity: '1',
          effectiveDate: new Date(),
        });

        // Wholesale pricing with quantity breaks
        await pricingRepository.createItemPricing({
          itemId: variant.id,
          priceListId: wholesalePriceList.id,
          unitPrice: (basePrice * sizeMultiplier * 0.8).toString(),
          minQuantity: '1',
          effectiveDate: new Date(),
        });

        await pricingRepository.createItemPricing({
          itemId: variant.id,
          priceListId: wholesalePriceList.id,
          unitPrice: (basePrice * sizeMultiplier * 0.75).toString(),
          minQuantity: '10',
          effectiveDate: new Date(),
        });
      }

      // Step 5: Assign items to vendor
      const vendor = cleanupIds.entities.find(id => true); // First entity is vendor
      const selectedVariant = variants[0]; // 13-inch, 8GB

      await vendorItemsRepository.create({
        vendorId: vendor!,
        itemId: selectedVariant.id,
        vendorItemCode: 'VENDOR-LAPTOP-13-8',
        vendorItemName: 'Vendor Laptop 13" 8GB',
        vendorUnitCost: '600',
        leadTimeDays: 7,
        minOrderQuantity: '5',
        isPreferred: true,
      });

      // Step 6: Create assembly item (laptop bundle)
      const bundleItem = await itemsRepository.create({
        organizationId: testOrganizationId,
        itemCode: 'LAPTOP-BUNDLE',
        name: 'Laptop Bundle',
        itemType: 'ASSEMBLY',
        unitOfMeasureId: eachUnit.id,
        incomeAccountId: cleanupIds.accounts[0],
        assetAccountId: cleanupIds.accounts[1],
        cogsAccountId: cleanupIds.accounts[2],
        defaultPrice: '1500.00',
        isActive: true,
        isSaleable: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });

      // Add components to bundle
      const mouseItem = await itemsRepository.create({
        organizationId: testOrganizationId,
        itemCode: 'MOUSE',
        name: 'Wireless Mouse',
        itemType: 'INVENTORY_ITEM',
        unitOfMeasureId: eachUnit.id,
        incomeAccountId: cleanupIds.accounts[0],
        assetAccountId: cleanupIds.accounts[1],
        cogsAccountId: cleanupIds.accounts[2],
        defaultPrice: '50.00',
        defaultCost: '25.00',
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });

      await assembliesKitsRepository.create({
        parentItemId: bundleItem.id,
        componentItemId: selectedVariant.id,
        quantity: '1',
        unitOfMeasureId: eachUnit.id,
        displayOrder: 1,
        isOptional: false,
        createdBy: testUserId,
        updatedBy: testUserId,
      });

      await assembliesKitsRepository.create({
        parentItemId: bundleItem.id,
        componentItemId: mouseItem.id,
        quantity: '1',
        unitOfMeasureId: eachUnit.id,
        displayOrder: 2,
        isOptional: false,
        createdBy: testUserId,
        updatedBy: testUserId,
      });

      // Verify assembly cost calculation
      const bundleCost = await assembliesKitsRepository.calculateTotalCost(
        bundleItem.id,
        testOrganizationId
      );
      expect(bundleCost).toBe(625); // 600 + 25

      // Step 7: Create serial numbers for tracking
      const serialNumbers = [];
      for (let i = 1; i <= 3; i++) {
        const serial = await inventoryTrackingRepository.createSerial({
          itemId: selectedVariant.id,
          serialNumber: `SN-LAPTOP-00${i}`,
          vendorId: vendor!,
          receivedDate: new Date(),
          status: 'AVAILABLE',
          createdBy: testUserId,
          updatedBy: testUserId,
        });
        serialNumbers.push(serial);
      }

      // Simulate selling a laptop
      const customer = cleanupIds.entities.find((id, idx) => idx === 1); // Second entity is customer
      await inventoryTrackingRepository.updateSerial(serialNumbers[0].id, {
        status: 'SOLD',
        customerId: customer!,
        soldDate: new Date(),
      });

      // Verify serial number tracking
      const availableSerials = await inventoryTrackingRepository.findSerialsByItem(
        selectedVariant.id,
        'AVAILABLE'
      );
      expect(availableSerials).toHaveLength(2);

      const soldSerials = await inventoryTrackingRepository.findSerialsByItem(
        selectedVariant.id,
        'SOLD'
      );
      expect(soldSerials).toHaveLength(1);

      // Step 8: Test price calculation for customer
      const calculatedPrice = await pricingRepository.calculatePrice({
        itemId: selectedVariant.id,
        customerId: customer!,
        quantity: 5,
        date: new Date(),
        organizationId: testOrganizationId,
      });

      // Should get retail price since no customer-specific pricing
      expect(calculatedPrice).toBeTruthy();
      expect(calculatedPrice?.unitPrice).toBe(1000);
      expect(calculatedPrice?.totalPrice).toBe(5000);

      // Assign wholesale price list to customer
      await pricingRepository.assignPriceListToCustomer({
        customerId: customer!,
        priceListId: wholesalePriceList.id,
        priority: 1,
        effectiveDate: new Date(),
      });

      // Recalculate with wholesale pricing
      const wholesalePrice = await pricingRepository.calculatePrice({
        itemId: selectedVariant.id,
        customerId: customer!,
        quantity: 12, // Should get bulk discount
        date: new Date(),
        organizationId: testOrganizationId,
      });

      expect(wholesalePrice?.unitPrice).toBe(750); // 75% of base price for qty >= 10
      expect(wholesalePrice?.totalPrice).toBe(9000);

      // Step 9: Verify search functionality
      const searchResults = await itemsRepository.findByOrganization(
        testOrganizationId,
        { query: 'laptop' }
      );
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults.some(i => i.itemCode === 'LAPTOP')).toBe(true);

      // Step 10: Test variant deactivation doesn't affect parent
      await itemsRepository.update(
        selectedVariant.id,
        testOrganizationId,
        { isActive: false }
      );

      const parent = await itemsRepository.findById(laptopParent.id, testOrganizationId);
      expect(parent?.isActive).toBe(true);

      // Cleanup
      // Note: In a real test, we'd clean up all created records
      console.log('E2E workflow completed successfully');
    });
  });
});