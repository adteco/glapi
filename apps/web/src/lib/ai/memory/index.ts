/**
 * GLAPI AI Memory Module
 *
 * Provides persistent memory capabilities for the AI chat agent using
 * the Magneteco memory service.
 */

// Magneteco Client
export {
  MagnetoClient,
  createMagnetoClient,
  MagnetoError,
  MagnetoNetworkError,
  type MagnetoClientConfig,
  type MemoryContext,
  type MemoryItem,
  type MemorizeResponse,
  type ProcessingStatusResponse,
  type ContentType,
  type Importance,
  type ClientMemorizeRequest,
  type ClientRetrieveRequest,
  // Domain Config Types
  type DomainConfig,
  type CategoryDefinition,
  type EntityTypeDefinition,
  type EntityProperty,
  type RelationshipDefinition,
  type RelevanceRule,
} from './magneteco-client';

// GLAPI Domain Config
export {
  glapiDomainConfig,
  createGlapiDomainConfig,
  GLAPI_CATEGORIES,
  GLAPI_ENTITY_TYPES,
  GLAPI_RELATIONSHIP_TYPES,
  GLAPI_RELEVANCE_RULES,
  GLAPI_EXTRACTION_PROMPT,
} from './glapi-domain-config';

// Memory Service
export {
  MemoryService,
  getMemoryService,
  resetMemoryService,
  formatMemoryContext,
  formatConversation,
  formatExchange,
  type MemoryServiceConfig,
  type RetrieveOptions,
  type MemorizeOptions,
  type Message,
} from './memory-service';
