import { eq } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { users } from '../db/schema/users';

export interface CreateUserInput {
  clerkUserId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  organizationId: string;
  role?: string;
}

export interface UpdateUserInput {
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: string;
  isActive?: boolean;
  lastLogin?: Date;
}

/**
 * @deprecated Use AuthEntityRepository instead.
 *
 * UserRepository is deprecated as part of the users table consolidation into entities.
 * All authenticated users are now represented as Employee entities with a clerkUserId.
 *
 * Migration guide:
 * - findByClerkId → authEntityRepository.findByClerkId
 * - create → authEntityRepository.createUserEntity
 * - updateByClerkId → authEntityRepository.updateByClerkId
 * - deleteByClerkId → authEntityRepository.deactivateByClerkId (soft delete)
 *
 * This repository will be removed in a future release.
 */
export class UserRepository extends BaseRepository {
  /**
   * Find a user by their Clerk user ID
   */
  async findByClerkId(clerkUserId: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.stytchUserId, clerkUserId))
      .limit(1);
    return user || null;
  }

  /**
   * Find a user by their database ID
   */
  async findById(id: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user || null;
  }

  /**
   * Find a user by email
   */
  async findByEmail(email: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user || null;
  }

  /**
   * Create a new user
   */
  async create(input: CreateUserInput) {
    const [user] = await this.db
      .insert(users)
      .values({
        stytchUserId: input.clerkUserId, // Using stytchUserId column for Clerk IDs
        email: input.email,
        firstName: input.firstName || null,
        lastName: input.lastName || null,
        organizationId: input.organizationId,
        role: input.role || 'user',
      })
      .returning();
    return user;
  }

  /**
   * Update an existing user by Clerk ID
   */
  async updateByClerkId(clerkUserId: string, input: UpdateUserInput) {
    const [user] = await this.db
      .update(users)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(users.stytchUserId, clerkUserId))
      .returning();
    return user || null;
  }

  /**
   * Delete a user by Clerk ID
   */
  async deleteByClerkId(clerkUserId: string) {
    const result = await this.db
      .delete(users)
      .where(eq(users.stytchUserId, clerkUserId))
      .returning();
    return result.length > 0;
  }

  /**
   * Update last login time
   */
  async updateLastLogin(clerkUserId: string) {
    await this.db
      .update(users)
      .set({
        lastLogin: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.stytchUserId, clerkUserId));
  }
}
