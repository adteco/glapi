import { NextRequest, NextResponse } from 'next/server';
import { EmployeeService } from '@glapi/api-service';
import { getServiceContext } from '../../utils/auth';

// GET /api/employees/:id - Get a employee by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const { id } = params;
    
    const employeeService = new EmployeeService(context);
    const result = await employeeService.getEmployeeById(id);
    
    if (!result) {
      return NextResponse.json(
        { message: `Employee with ID "${id}" not found` },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ employee: result });
  } catch (error) {
    console.error('Error getting employee:', error);
    
    // Check if it's a ServiceError
    if (error && typeof error === 'object' && 'statusCode' in error && 'code' in error) {
      const serviceError = error as any;
      return NextResponse.json(
        {
          message: serviceError.message,
          code: serviceError.code,
          details: serviceError.details
        },
        { status: serviceError.statusCode }
      );
    }
    
    // Generic error handling
    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/employees/:id - Update a employee
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const { id } = params;
    const body = await request.json();
    
    const employeeService = new EmployeeService(context);
    
    // Get the employee to ensure it exists
    const existingEmployee = await employeeService.getEmployeeById(id);
    if (!existingEmployee) {
      return NextResponse.json(
        { message: `Employee with ID "${id}" not found` },
        { status: 404 }
      );
    }
    
    // Update the employee
    const result = await employeeService.updateEmployee(id, body);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating employee:', error);
    
    // Check if it's a ServiceError
    if (error && typeof error === 'object' && 'statusCode' in error && 'code' in error) {
      const serviceError = error as any;
      return NextResponse.json(
        {
          message: serviceError.message,
          code: serviceError.code,
          details: serviceError.details
        },
        { status: serviceError.statusCode }
      );
    }
    
    // Generic error handling
    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/employees/:id - Delete a employee
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = getServiceContext();
    const { id } = params;
    
    const employeeService = new EmployeeService(context);
    
    // Delete the employee
    await employeeService.deleteEmployee(id);
    
    return NextResponse.json({
      success: true,
      message: 'Employee deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting employee:', error);
    
    // Check if it's a ServiceError
    if (error && typeof error === 'object' && 'statusCode' in error && 'code' in error) {
      const serviceError = error as any;
      return NextResponse.json(
        {
          message: serviceError.message,
          code: serviceError.code,
          details: serviceError.details
        },
        { status: serviceError.statusCode }
      );
    }
    
    // Generic error handling
    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}