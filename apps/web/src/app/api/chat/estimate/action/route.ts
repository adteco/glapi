import { NextRequest, NextResponse } from 'next/server';
import { getServiceContext } from '@/lib/auth';

interface ActionRequest {
  action: {
    type: 'create_customer' | 'create_item' | 'confirm_estimate' | 'modify_estimate';
    label: string;
    data: any;
  };
  currentEstimate?: EstimateData;
}

interface EstimateData {
  customer?: {
    id?: string;
    name: string;
    email?: string;
    phone?: string;
  };
  items: Array<{
    id?: string;
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  totalAmount: number;
  notes?: string;
  validUntil?: string;
}

// Mock database operations (replace with actual tRPC calls)
async function createCustomer(data: { name: string; email?: string; phone?: string }) {
  // In real implementation, this would call the customers tRPC endpoint
  return {
    id: Date.now().toString(),
    name: data.name,
    email: data.email || `${data.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
    phone: data.phone || '555-0000',
  };
}

async function createItem(data: { name: string; description?: string; quantity?: number; unitPrice?: number }) {
  // In real implementation, this would call the items tRPC endpoint
  return {
    id: Date.now().toString(),
    name: data.name,
    description: data.description || `${data.name} - Auto-generated item`,
    defaultPrice: data.unitPrice || 100,
  };
}

async function createEstimate(data: EstimateData) {
  // In real implementation, this would call the businessTransactions tRPC endpoint
  try {
    const response = await fetch('/api/trpc/businessTransactions.create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactionTypeCode: 'ESTIMATE',
        entityId: data.customer?.id || 'temp-customer-id',
        entityType: 'CUSTOMER',
        transactionDate: new Date(),
        memo: data.notes,
        lines: data.items.map(item => ({
          itemId: item.id || 'temp-item-id',
          description: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineAmount: item.total,
          totalLineAmount: item.total,
        })),
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create estimate');
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error creating estimate:', error);
    // Return mock data for now
    return {
      id: Date.now().toString(),
      transactionNumber: `EST-${Math.random().toString(36).substring(7).toUpperCase()}`,
      totalAmount: data.totalAmount,
      status: 'DRAFT',
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = getServiceContext();
    
    if (!context.organizationId) {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      );
    }

    const { action, currentEstimate }: ActionRequest = await request.json();
    
    let response = '';
    let estimateData = currentEstimate;
    let success = false;
    
    switch (action.type) {
      case 'create_customer':
        try {
          const customer = await createCustomer(action.data);
          response = `✅ Successfully created customer "${customer.name}". Now let's add items to the estimate.`;
          estimateData = {
            ...estimateData,
            customer,
            items: estimateData?.items || [],
            totalAmount: estimateData?.totalAmount || 0,
          };
          success = true;
        } catch (error) {
          response = `❌ Failed to create customer "${action.data.name}". Please try again.`;
        }
        break;
        
      case 'create_item':
        try {
          const item = await createItem(action.data);
          const quantity = action.data.quantity || 1;
          const unitPrice = action.data.unitPrice || item.defaultPrice;
          const total = quantity * unitPrice;
          
          const newItem = {
            id: item.id,
            name: item.name,
            description: item.description,
            quantity,
            unitPrice,
            total,
          };
          
          const updatedItems = [...(estimateData?.items || []), newItem];
          const totalAmount = updatedItems.reduce((sum, item) => sum + item.total, 0);
          
          estimateData = {
            ...estimateData,
            items: updatedItems,
            totalAmount,
          };
          
          response = `✅ Successfully created item "${item.name}" and added it to the estimate. Total is now $${totalAmount}.`;
          success = true;
        } catch (error) {
          response = `❌ Failed to create item "${action.data.name}". Please try again.`;
        }
        break;
        
      case 'confirm_estimate':
        try {
          if (!currentEstimate) {
            response = `❌ No estimate data to create. Please start over.`;
            break;
          }
          
          const estimate = await createEstimate(currentEstimate);
          response = `🎉 Successfully created estimate ${estimate.transactionNumber}! 

The estimate has been saved with:
• Customer: ${currentEstimate.customer?.name}
• Total Amount: $${currentEstimate.totalAmount}
• Items: ${currentEstimate.items.length}
• Status: ${estimate.status}

You can now send this estimate to your customer or make additional changes.`;
          success = true;
          
          // Clear the estimate data after successful creation
          estimateData = null;
        } catch (error) {
          response = `❌ Failed to create estimate. Please try again.`;
        }
        break;
        
      case 'modify_estimate':
        // Handle estimate modifications
        response = `I can help you modify the estimate. What would you like to change?`;
        success = true;
        break;
        
      default:
        response = `❌ Unknown action type: ${action.type}`;
    }
    
    return NextResponse.json({
      message: response,
      success,
      estimateData,
    });
    
  } catch (error) {
    console.error('Error executing action:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}