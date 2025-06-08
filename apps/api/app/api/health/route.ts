import { NextRequest, NextResponse } from 'next/server';
import { AccountService } from '@glapi/api-service';
import { getServiceContext } from '../utils/auth';

// GET /api/health - Health check endpoint
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  const health = {
    status: 'checking',
    timestamp: new Date().toISOString(),
    checks: {
      api: {
        status: 'unknown',
        message: '',
        responseTime: 0
      },
      service: {
        status: 'unknown',
        message: '',
        responseTime: 0
      },
      database: {
        status: 'unknown',
        message: '',
        responseTime: 0
      }
    }
  };

  try {
    // 1. API Layer Health Check
    const apiStartTime = Date.now();
    health.checks.api.status = 'healthy';
    health.checks.api.message = 'API is responding';
    health.checks.api.responseTime = Date.now() - apiStartTime;
    
    // 2. Service Layer Health Check
    const serviceStartTime = Date.now();
    try {
      const context = getServiceContext();
      const accountService = new AccountService(context);
      
      // Call a method to verify service layer is working
      const serviceHealth = await accountService.healthCheck();
      
      health.checks.service.status = serviceHealth.status;
      health.checks.service.message = serviceHealth.message;
      health.checks.service.responseTime = Date.now() - serviceStartTime;
    } catch (error) {
      health.checks.service.status = 'unhealthy';
      health.checks.service.message = error instanceof Error ? error.message : 'Service layer error';
      health.checks.service.responseTime = Date.now() - serviceStartTime;
    }
    
    // 3. Database Health Check (via service layer)
    const dbStartTime = Date.now();
    try {
      const context = getServiceContext();
      const accountService = new AccountService(context);
      const dbHealth = await accountService.checkDatabaseConnection();
      
      health.checks.database.status = dbHealth.status;
      health.checks.database.message = dbHealth.message;
      health.checks.database.responseTime = Date.now() - dbStartTime;
    } catch (error) {
      health.checks.database.status = 'unhealthy';
      health.checks.database.message = error instanceof Error ? error.message : 'Database connection error';
      health.checks.database.responseTime = Date.now() - dbStartTime;
    }
    
    // Determine overall status
    const allHealthy = Object.values(health.checks).every(check => check.status === 'healthy');
    health.status = allHealthy ? 'healthy' : 'unhealthy';
    
    return NextResponse.json(health, { 
      status: allHealthy ? 200 : 503 
    });
    
  } catch (error) {
    console.error('Health check error:', error);
    
    health.status = 'error';
    health.checks.api.status = 'error';
    health.checks.api.message = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(health, { status: 503 });
  }
}