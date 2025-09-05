import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SubscriptionRepository } from "../subscription-repository";
import { db } from "../../db";
import { subscriptions, subscriptionItems } from "../../db/schema/subscriptions";
import { organizations } from "../../db/schema/organizations";
import { entities } from "../../db/schema/entities";
import { items } from "../../db/schema/items";
import { sql } from "drizzle-orm";

describe("SubscriptionRepository", () => {
  let repository: SubscriptionRepository;
  let testOrgId: string;
  let testEntityId: string;
  let testItemId: string;

  beforeEach(async () => {
    repository = new SubscriptionRepository();
    
    // Set up test data
    await db.transaction(async (tx) => {
      // Create test organization
      const [org] = await tx
        .insert(organizations)
        .values({
          name: "Test Organization",
          clerkOrganizationId: "test_org_" + Date.now()
        })
        .returning();
      testOrgId = org.id;

      // Create test entity (customer)
      const [entity] = await tx
        .insert(entities)
        .values({
          organizationId: testOrgId,
          name: "Test Customer",
          entityTypes: ["customer"],
          status: "active"
        })
        .returning();
      testEntityId = entity.id;

      // Create test item
      const [item] = await tx
        .insert(items)
        .values({
          organizationId: testOrgId,
          name: "Test Product",
          code: "TEST-001",
          type: "service"
        })
        .returning();
      testItemId = item.id;
    });
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(subscriptionItems).where(sql`1=1`);
    await db.delete(subscriptions).where(sql`1=1`);
    await db.delete(items).where(sql`1=1`);
    await db.delete(entities).where(sql`1=1`);
    await db.delete(organizations).where(sql`1=1`);
  });

  describe("create", () => {
    it("should create a new subscription", async () => {
      const subscriptionData = {
        organizationId: testOrgId,
        entityId: testEntityId,
        subscriptionNumber: "SUB-001",
        status: "draft" as const,
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        contractValue: "12000.00",
        billingFrequency: "monthly" as const,
        autoRenew: false
      };

      const result = await repository.create(subscriptionData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.subscriptionNumber).toBe("SUB-001");
      expect(result.status).toBe("draft");
    });

    it("should enforce unique subscription number per organization", async () => {
      const subscriptionData = {
        organizationId: testOrgId,
        entityId: testEntityId,
        subscriptionNumber: "SUB-002",
        status: "draft" as const,
        startDate: "2024-01-01"
      };

      await repository.create(subscriptionData);
      
      await expect(repository.create(subscriptionData)).rejects.toThrow();
    });
  });

  describe("createWithItems", () => {
    it("should create subscription with line items", async () => {
      const subscriptionData = {
        organizationId: testOrgId,
        entityId: testEntityId,
        subscriptionNumber: "SUB-003",
        status: "active" as const,
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        billingFrequency: "annual" as const
      };

      const itemsData = [
        {
          itemId: testItemId,
          quantity: "1",
          unitPrice: "1000.00",
          discountPercentage: "10",
          startDate: "2024-01-01",
          endDate: "2024-12-31"
        }
      ];

      const result = await repository.createWithItems(subscriptionData, itemsData);

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(1);
      expect(result.items![0].unitPrice).toBe("1000.00");
      expect(result.items![0].discountPercentage).toBe("10");
    });
  });

  describe("findByIdWithItems", () => {
    it("should retrieve subscription with its items", async () => {
      const subscription = await repository.createWithItems(
        {
          organizationId: testOrgId,
          entityId: testEntityId,
          subscriptionNumber: "SUB-004",
          status: "active" as const,
          startDate: "2024-01-01"
        },
        [
          {
            itemId: testItemId,
            quantity: "2",
            unitPrice: "500.00",
            startDate: "2024-01-01"
          }
        ]
      );

      const result = await repository.findByIdWithItems(subscription.id);

      expect(result).toBeDefined();
      expect(result!.id).toBe(subscription.id);
      expect(result!.items).toHaveLength(1);
      expect(result!.items![0].quantity).toBe("2");
    });

    it("should return null for non-existent subscription", async () => {
      const result = await repository.findByIdWithItems("00000000-0000-0000-0000-000000000000");
      expect(result).toBeNull();
    });
  });

  describe("findByNumber", () => {
    it("should find subscription by number", async () => {
      await repository.create({
        organizationId: testOrgId,
        entityId: testEntityId,
        subscriptionNumber: "SUB-005",
        status: "active" as const,
        startDate: "2024-01-01"
      });

      const result = await repository.findByNumber(testOrgId, "SUB-005");

      expect(result).toBeDefined();
      expect(result!.subscriptionNumber).toBe("SUB-005");
    });

    it("should return null for non-existent subscription number", async () => {
      const result = await repository.findByNumber(testOrgId, "NON-EXISTENT");
      expect(result).toBeNull();
    });
  });

  describe("list", () => {
    beforeEach(async () => {
      // Create multiple subscriptions for testing
      await repository.create({
        organizationId: testOrgId,
        entityId: testEntityId,
        subscriptionNumber: "LIST-001",
        status: "active" as const,
        startDate: "2024-01-01"
      });

      await repository.create({
        organizationId: testOrgId,
        entityId: testEntityId,
        subscriptionNumber: "LIST-002",
        status: "draft" as const,
        startDate: "2024-02-01"
      });

      await repository.create({
        organizationId: testOrgId,
        entityId: testEntityId,
        subscriptionNumber: "LIST-003",
        status: "active" as const,
        startDate: "2024-03-01"
      });
    });

    it("should list all subscriptions for organization", async () => {
      const result = await repository.list({ organizationId: testOrgId });

      expect(result.data).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it("should filter by status", async () => {
      const result = await repository.list({
        organizationId: testOrgId,
        status: "active"
      });

      expect(result.data).toHaveLength(2);
      expect(result.data.every(s => s.status === "active")).toBe(true);
    });

    it("should filter by date range", async () => {
      const result = await repository.list({
        organizationId: testOrgId,
        startDateFrom: "2024-02-01",
        startDateTo: "2024-03-01"
      });

      expect(result.data).toHaveLength(2);
    });

    it("should search by subscription number", async () => {
      const result = await repository.list({
        organizationId: testOrgId,
        search: "LIST-002"
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].subscriptionNumber).toBe("LIST-002");
    });

    it("should paginate results", async () => {
      const result = await repository.list({
        organizationId: testOrgId,
        limit: 2,
        offset: 1
      });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(3);
    });
  });

  describe("update", () => {
    it("should update subscription", async () => {
      const subscription = await repository.create({
        organizationId: testOrgId,
        entityId: testEntityId,
        subscriptionNumber: "SUB-006",
        status: "draft" as const,
        startDate: "2024-01-01"
      });

      const updated = await repository.update(subscription.id, {
        status: "active" as const,
        contractValue: "15000.00"
      });

      expect(updated).toBeDefined();
      expect(updated!.status).toBe("active");
      expect(updated!.contractValue).toBe("15000.00");
    });
  });

  describe("calculateContractValue", () => {
    it("should calculate total contract value from items", async () => {
      const subscription = await repository.createWithItems(
        {
          organizationId: testOrgId,
          entityId: testEntityId,
          subscriptionNumber: "SUB-007",
          status: "active" as const,
          startDate: "2024-01-01"
        },
        [
          {
            itemId: testItemId,
            quantity: "2",
            unitPrice: "1000.00",
            discountPercentage: "10",
            startDate: "2024-01-01"
          },
          {
            itemId: testItemId,
            quantity: "1",
            unitPrice: "500.00",
            discountPercentage: "0",
            startDate: "2024-01-01"
          }
        ]
      );

      const value = await repository.calculateContractValue(subscription.id);

      // (2 * 1000 * 0.9) + (1 * 500) = 1800 + 500 = 2300
      expect(value).toBe(2300);
    });
  });

  describe("hasOverlappingSubscription", () => {
    beforeEach(async () => {
      await repository.create({
        organizationId: testOrgId,
        entityId: testEntityId,
        subscriptionNumber: "OVERLAP-001",
        status: "active" as const,
        startDate: "2024-01-01",
        endDate: "2024-06-30"
      });
    });

    it("should detect overlapping subscriptions", async () => {
      const hasOverlap = await repository.hasOverlappingSubscription(
        testOrgId,
        testEntityId,
        "2024-05-01",
        "2024-12-31"
      );

      expect(hasOverlap).toBe(true);
    });

    it("should not detect overlap when dates don't overlap", async () => {
      const hasOverlap = await repository.hasOverlappingSubscription(
        testOrgId,
        testEntityId,
        "2024-07-01",
        "2024-12-31"
      );

      expect(hasOverlap).toBe(false);
    });
  });

  describe("getActiveSubscriptionsByEntity", () => {
    it("should get active subscriptions for an entity", async () => {
      await repository.create({
        organizationId: testOrgId,
        entityId: testEntityId,
        subscriptionNumber: "ACTIVE-001",
        status: "active" as const,
        startDate: "2024-01-01"
      });

      await repository.create({
        organizationId: testOrgId,
        entityId: testEntityId,
        subscriptionNumber: "INACTIVE-001",
        status: "cancelled" as const,
        startDate: "2024-01-01"
      });

      const result = await repository.getActiveSubscriptionsByEntity(testOrgId, testEntityId);

      expect(result).toHaveLength(1);
      expect(result[0].subscriptionNumber).toBe("ACTIVE-001");
    });
  });
});