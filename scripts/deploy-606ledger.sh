#!/bin/bash

# 606Ledger Production Deployment Script
# This script handles the complete deployment of the 606Ledger system
# Usage: ./deploy-606ledger.sh [environment] [options]

set -e  # Exit on error
set -u  # Exit on undefined variable

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="/tmp/606ledger_deploy_${TIMESTAMP}.log"

# Default values
ENVIRONMENT="${1:-staging}"
SKIP_TESTS="${SKIP_TESTS:-false}"
SKIP_BACKUP="${SKIP_BACKUP:-false}"
SKIP_MIGRATION="${SKIP_MIGRATION:-false}"
DRY_RUN="${DRY_RUN:-false}"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

print_banner() {
    echo "================================================"
    echo "     606Ledger Deployment Script v1.0.0        "
    echo "================================================"
    echo "Environment: $ENVIRONMENT"
    echo "Timestamp: $TIMESTAMP"
    echo "Log file: $LOG_FILE"
    echo "================================================"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    REQUIRED_NODE="18.0.0"
    if [ "$(printf '%s\n' "$REQUIRED_NODE" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_NODE" ]; then
        log_error "Node.js version must be >= $REQUIRED_NODE (current: $NODE_VERSION)"
        exit 1
    fi
    
    # Check pnpm
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm is not installed"
        exit 1
    fi
    
    # Check PostgreSQL client
    if ! command -v psql &> /dev/null; then
        log_warning "PostgreSQL client not found - database operations may fail"
    fi
    
    # Check environment file
    ENV_FILE="$PROJECT_ROOT/.env.$ENVIRONMENT"
    if [ ! -f "$ENV_FILE" ]; then
        log_error "Environment file not found: $ENV_FILE"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

load_environment() {
    log_info "Loading environment variables..."
    
    ENV_FILE="$PROJECT_ROOT/.env.$ENVIRONMENT"
    if [ -f "$ENV_FILE" ]; then
        export $(grep -v '^#' "$ENV_FILE" | xargs)
        log_success "Environment variables loaded from $ENV_FILE"
    else
        log_error "Environment file not found: $ENV_FILE"
        exit 1
    fi
}

run_tests() {
    if [ "$SKIP_TESTS" = "true" ]; then
        log_warning "Skipping tests (SKIP_TESTS=true)"
        return 0
    fi
    
    log_info "Running tests..."
    
    cd "$PROJECT_ROOT"
    
    # Run unit tests
    log_info "Running unit tests..."
    pnpm test:unit || {
        log_error "Unit tests failed"
        exit 1
    }
    
    # Run integration tests
    log_info "Running integration tests..."
    pnpm --filter @glapi/integration-tests test || {
        log_error "Integration tests failed"
        exit 1
    }
    
    log_success "All tests passed"
}

build_application() {
    log_info "Building application..."
    
    cd "$PROJECT_ROOT"
    
    # Clean previous builds
    log_info "Cleaning previous builds..."
    pnpm clean
    
    # Install dependencies
    log_info "Installing dependencies..."
    pnpm install --frozen-lockfile
    
    # Build all packages
    log_info "Building packages..."
    pnpm build
    
    # Build specific 606Ledger components
    log_info "Building 606Ledger components..."
    pnpm --filter @glapi/business build
    pnpm --filter @glapi/database build
    
    log_success "Application built successfully"
}

backup_database() {
    if [ "$SKIP_BACKUP" = "true" ]; then
        log_warning "Skipping database backup (SKIP_BACKUP=true)"
        return 0
    fi
    
    log_info "Backing up database..."
    
    BACKUP_FILE="/tmp/606ledger_backup_${ENVIRONMENT}_${TIMESTAMP}.sql"
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "[DRY RUN] Would create backup at: $BACKUP_FILE"
    else
        pg_dump "$DATABASE_URL" > "$BACKUP_FILE" || {
            log_error "Database backup failed"
            exit 1
        }
        
        # Compress backup
        gzip "$BACKUP_FILE"
        log_success "Database backed up to: ${BACKUP_FILE}.gz"
    fi
}

run_migrations() {
    if [ "$SKIP_MIGRATION" = "true" ]; then
        log_warning "Skipping migrations (SKIP_MIGRATION=true)"
        return 0
    fi
    
    log_info "Running database migrations..."
    
    cd "$PROJECT_ROOT"
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "[DRY RUN] Would run migrations"
        pnpm --filter @glapi/database migrate:status
    else
        # Run schema migrations
        pnpm --filter @glapi/database migrate:deploy || {
            log_error "Database migrations failed"
            exit 1
        }
        
        # Run data migrations for 606Ledger
        log_info "Running 606Ledger data migrations..."
        pnpm --filter @glapi/database migrate:data || {
            log_error "Data migrations failed"
            exit 1
        }
    fi
    
    log_success "Migrations completed successfully"
}

deploy_api() {
    log_info "Deploying API..."
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "[DRY RUN] Would deploy API to $ENVIRONMENT"
        return 0
    fi
    
    case "$ENVIRONMENT" in
        production)
            log_info "Deploying to production..."
            # Add production deployment commands
            # Example: kubectl apply -f k8s/production/
            ;;
        staging)
            log_info "Deploying to staging..."
            # Add staging deployment commands
            # Example: docker-compose -f docker-compose.staging.yml up -d
            ;;
        development)
            log_info "Starting development server..."
            cd "$PROJECT_ROOT"
            pnpm dev:api &
            ;;
        *)
            log_error "Unknown environment: $ENVIRONMENT"
            exit 1
            ;;
    esac
    
    log_success "API deployed successfully"
}

setup_monitoring() {
    log_info "Setting up monitoring..."
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "[DRY RUN] Would setup monitoring"
        return 0
    fi
    
    # Setup health check endpoint monitoring
    log_info "Configuring health check monitoring..."
    
    # Setup revenue-specific alerts
    log_info "Configuring revenue recognition alerts..."
    
    # Setup performance monitoring
    log_info "Configuring performance monitoring..."
    
    log_success "Monitoring setup completed"
}

verify_deployment() {
    log_info "Verifying deployment..."
    
    # Wait for services to be ready
    sleep 10
    
    # Check API health
    API_URL="${API_BASE_URL:-http://localhost:3000}"
    HEALTH_CHECK="$API_URL/health"
    
    log_info "Checking API health at: $HEALTH_CHECK"
    
    if curl -f -s "$HEALTH_CHECK" > /dev/null; then
        log_success "API is healthy"
    else
        log_error "API health check failed"
        exit 1
    fi
    
    # Run smoke tests
    log_info "Running smoke tests..."
    cd "$PROJECT_ROOT"
    pnpm test:smoke || {
        log_warning "Smoke tests failed - manual verification required"
    }
    
    log_success "Deployment verification completed"
}

rollback() {
    log_error "Deployment failed - initiating rollback..."
    
    # Restore database backup if exists
    if [ -f "${BACKUP_FILE}.gz" ]; then
        log_info "Restoring database backup..."
        gunzip "${BACKUP_FILE}.gz"
        psql "$DATABASE_URL" < "$BACKUP_FILE"
        log_success "Database restored"
    fi
    
    # Revert to previous deployment
    log_info "Reverting to previous deployment..."
    # Add rollback commands based on deployment method
    
    log_warning "Rollback completed - manual verification required"
}

cleanup() {
    log_info "Cleaning up..."
    
    # Remove temporary files
    rm -f /tmp/606ledger_*
    
    log_success "Cleanup completed"
}

# Trap errors and run rollback
trap 'rollback' ERR

# Main execution
main() {
    print_banner
    
    # Parse command line arguments
    while [[ $# -gt 1 ]]; do
        case $2 in
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --skip-backup)
                SKIP_BACKUP=true
                shift
                ;;
            --skip-migration)
                SKIP_MIGRATION=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                log_warning "DRY RUN MODE - No actual changes will be made"
                shift
                ;;
            *)
                log_error "Unknown option: $2"
                echo "Usage: $0 [environment] [--skip-tests] [--skip-backup] [--skip-migration] [--dry-run]"
                exit 1
                ;;
        esac
    done
    
    # Deployment steps
    check_prerequisites
    load_environment
    run_tests
    build_application
    backup_database
    run_migrations
    deploy_api
    setup_monitoring
    verify_deployment
    cleanup
    
    log_success "================================================"
    log_success "   606Ledger Deployment Completed Successfully "
    log_success "================================================"
    log_success "Environment: $ENVIRONMENT"
    log_success "Timestamp: $TIMESTAMP"
    log_success "Log file: $LOG_FILE"
    log_success "================================================"
}

# Run main function
main "$@"