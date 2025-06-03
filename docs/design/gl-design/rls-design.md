# Row-Level Security (RLS) Design for GL System

## Overview

This document outlines the Row-Level Security implementation strategy for the GL system to ensure users only access data they're authorized to view.

## Security Requirements

### 1. Multi-tenancy Support
- Complete data isolation between subsidiaries/companies
- No cross-subsidiary data leakage
- Support for users with access to multiple subsidiaries

### 2. Hierarchical Access Control
- Department-level restrictions
- Location-based access
- Class-based visibility
- Project-specific permissions

### 3. Role-Based Permissions
- View-only vs. transactional roles
- Approval authority limits
- Report access restrictions

## Implementation Approach

### Option 1: Database-Level RLS (PostgreSQL)

```sql
-- Enable RLS on tables
ALTER TABLE business_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_account_balances ENABLE ROW LEVEL SECURITY;

-- Create security policies
CREATE POLICY subsidiary_isolation ON business_transactions
    FOR ALL
    USING (subsidiary_id IN (
        SELECT subsidiary_id 
        FROM user_subsidiary_access 
        WHERE user_id = current_user_id()
    ));

CREATE POLICY department_access ON business_transactions
    FOR SELECT
    USING (
        department_id IN (
            SELECT department_id 
            FROM user_department_access 
            WHERE user_id = current_user_id()
        ) 
        OR EXISTS (
            SELECT 1 
            FROM user_roles 
            WHERE user_id = current_user_id() 
            AND role_name = 'ADMIN'
        )
    );
```

### Option 2: Application-Level RLS

```typescript
// Base repository with RLS
export class SecureRepository<T> {
    protected applyRLS(query: any, user: User) {
        // Always filter by subsidiary
        query.where('subsidiary_id', 'IN', user.allowedSubsidiaries);
        
        // Apply department filter if not admin
        if (!user.hasRole('ADMIN')) {
            query.where('department_id', 'IN', user.allowedDepartments);
        }
        
        // Apply additional filters based on user permissions
        return this.applyAdditionalFilters(query, user);
    }
}

// Usage in service
class TransactionService {
    async getTransactions(user: User, filters: any) {
        const query = db.select()
            .from('business_transactions');
        
        // Apply RLS automatically
        this.repository.applyRLS(query, user);
        
        // Apply business filters
        if (filters.dateFrom) {
            query.where('transaction_date', '>=', filters.dateFrom);
        }
        
        return query;
    }
}
```

## Required Database Schema Additions

### 1. User Access Control Tables

```sql
-- User subsidiary access
CREATE TABLE user_subsidiary_access (
    user_id INT NOT NULL,
    subsidiary_id INT NOT NULL,
    access_level VARCHAR(20) DEFAULT 'READ', -- 'READ', 'WRITE', 'APPROVE', 'ADMIN'
    granted_by INT,
    granted_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, subsidiary_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (subsidiary_id) REFERENCES subsidiaries(subsidiary_id)
);

-- User department access
CREATE TABLE user_department_access (
    user_id INT NOT NULL,
    department_id INT NOT NULL,
    access_level VARCHAR(20) DEFAULT 'READ',
    PRIMARY KEY (user_id, department_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (department_id) REFERENCES departments(department_id)
);

-- User location access
CREATE TABLE user_location_access (
    user_id INT NOT NULL,
    location_id INT NOT NULL,
    access_level VARCHAR(20) DEFAULT 'READ',
    PRIMARY KEY (user_id, location_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (location_id) REFERENCES locations(location_id)
);

-- User class access
CREATE TABLE user_class_access (
    user_id INT NOT NULL,
    class_id INT NOT NULL,
    access_level VARCHAR(20) DEFAULT 'READ',
    PRIMARY KEY (user_id, class_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (class_id) REFERENCES classes(class_id)
);

-- Role definitions
CREATE TABLE roles (
    role_id INT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    role_description TEXT,
    is_system_role BOOLEAN DEFAULT FALSE
);

-- User role assignments
CREATE TABLE user_roles (
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    subsidiary_id INT, -- Role can be subsidiary-specific
    granted_by INT,
    granted_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_date TIMESTAMP,
    PRIMARY KEY (user_id, role_id, subsidiary_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (role_id) REFERENCES roles(role_id),
    FOREIGN KEY (subsidiary_id) REFERENCES subsidiaries(subsidiary_id)
);

-- Permission definitions
CREATE TABLE permissions (
    permission_id INT PRIMARY KEY AUTO_INCREMENT,
    permission_name VARCHAR(100) UNIQUE NOT NULL,
    resource_type VARCHAR(50), -- 'TRANSACTION', 'REPORT', 'CONFIGURATION'
    action VARCHAR(50), -- 'VIEW', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'POST'
    description TEXT
);

-- Role permissions
CREATE TABLE role_permissions (
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(role_id),
    FOREIGN KEY (permission_id) REFERENCES permissions(permission_id)
);

-- Account access restrictions
CREATE TABLE user_account_restrictions (
    user_id INT NOT NULL,
    account_id INT NOT NULL,
    restriction_type VARCHAR(20), -- 'DENY_VIEW', 'DENY_POST'
    PRIMARY KEY (user_id, account_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

-- Amount-based approval limits
CREATE TABLE user_approval_limits (
    user_id INT NOT NULL,
    transaction_type_id INT NOT NULL,
    subsidiary_id INT NOT NULL,
    max_amount DECIMAL(18,4),
    currency_code CHAR(3),
    PRIMARY KEY (user_id, transaction_type_id, subsidiary_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (transaction_type_id) REFERENCES transaction_types(transaction_type_id),
    FOREIGN KEY (subsidiary_id) REFERENCES subsidiaries(subsidiary_id)
);
```

### 2. Audit Extensions

```sql
-- Data access audit log
CREATE TABLE data_access_log (
    log_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    access_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    table_name VARCHAR(100),
    record_id BIGINT,
    action VARCHAR(20), -- 'VIEW', 'EXPORT', 'REPORT'
    ip_address VARCHAR(45),
    user_agent TEXT,
    access_context TEXT -- Additional context about the access
);

-- Sensitive data access alerts
CREATE TABLE sensitive_access_alerts (
    alert_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    alert_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    alert_type VARCHAR(50), -- 'UNUSUAL_ACCESS', 'AFTER_HOURS', 'BULK_EXPORT'
    details JSON,
    reviewed_by INT,
    reviewed_date TIMESTAMP
);
```

## Implementation Strategy

### Phase 1: Foundation
1. Create user access control tables
2. Implement basic subsidiary-level isolation
3. Add role and permission management

### Phase 2: Application Integration
1. Create RLS middleware/interceptors
2. Update all repository classes
3. Add permission checking to services

### Phase 3: Advanced Features
1. Implement hierarchical permissions
2. Add approval limit enforcement
3. Create audit trail for sensitive access

### Phase 4: Performance Optimization
1. Add indexes for access control queries
2. Implement permission caching
3. Optimize RLS query performance

## Security Policies

### 1. Default Deny
- Users have no access by default
- Access must be explicitly granted
- Principle of least privilege

### 2. Inheritance Rules
- Department access includes all classes within
- Location access includes all departments within
- Subsidiary admin has full subsidiary access

### 3. Temporal Access
- Support time-limited access
- Automatic access expiration
- Access review workflows

## Testing Strategy

### Security Test Cases
1. Cross-subsidiary data isolation
2. Department-level filtering
3. Role-based access control
4. Approval limit enforcement
5. Audit trail completeness

### Performance Testing
1. Query performance with RLS
2. Large user base scenarios
3. Complex permission hierarchies

## Monitoring and Compliance

### Real-time Monitoring
- Unusual access patterns
- Failed access attempts
- Bulk data exports
- After-hours access

### Compliance Reports
- User access matrix
- Permission change history
- Sensitive data access log
- Segregation of duties verification

## Integration Points

### 1. Authentication System
- SSO integration
- Session management
- Token-based auth

### 2. External Systems
- API key management
- Service account permissions
- Third-party access control

### 3. Reporting Tools
- BI tool integration
- Report-level security
- Data export controls

## Best Practices

1. **Regular Access Reviews**
   - Quarterly permission audits
   - Automated access certification
   - Orphaned access cleanup

2. **Change Management**
   - Permission change approval workflow
   - Audit trail for all changes
   - Impact analysis tools

3. **Emergency Access**
   - Break-glass procedures
   - Temporary elevated access
   - Full audit trail

4. **Data Classification**
   - Sensitive account marking
   - PII field identification
   - Encryption requirements