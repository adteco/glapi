import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { db } from '../db';

/**
 * Base repository class that provides common database operations and access to the database client
 */
export abstract class BaseRepository {
  protected db: NodePgDatabase;
  
  constructor() {
    this.db = db;
  }
}