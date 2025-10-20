import { NextRequest, NextResponse } from 'next/server';
import { getServiceContext } from '@/lib/auth';

// Mock OpenAI integration - replace with actual OpenAI client
interface ChatRequest {
  message: string;
  conversationHistory: Array<{
    type: 'user' | 'assistant' | 'system';
    content: string;
  }>;
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

interface ParsedIntent {
  intent: 'create_estimate' | 'modify_estimate' | 'confirm_estimate' | 'lookup_customer' | 'lookup_item' | 'general_inquiry';
  entities: {
    customer?: string;
    items?: Array<{
      name: string;
      quantity?: number;
      unitPrice?: number;
      total?: number;
    }>;
    totalAmount?: number;
    notes?: string;
  };
  confidence: number;
}

// Simple NLP intent recognition (replace with actual AI service)
function parseIntent(message: string): ParsedIntent {
  const lowerMessage = message.toLowerCase();
  
  // Keywords for different intents
  const createKeywords = ['create', 'generate', 'make', 'new', 'estimate', 'quote'];
  const modifyKeywords = ['change', 'update', 'modify', 'edit', 'adjust'];
  const confirmKeywords = ['confirm', 'approve', 'save', 'create it', 'looks good'];
  
  // Extract customer name
  const customerMatch = message.match(/for\s+([A-Za-z\s]+?)(?:\s+for|\s+worth|\s+at|\s*$)/i);
  const customer = customerMatch ? customerMatch[1].trim() : undefined;
  
  // Extract amounts
  const amountMatch = message.match(/\$?([\d,]+(?:\.\d{2})?)/);
  const totalAmount = amountMatch ? parseFloat(amountMatch[1].replace(',', '')) : undefined;
  
  // Extract items with quantities and prices
  const itemMatches = message.match(/(\d+)\s+([a-zA-Z\s]+?)(?:\s+at\s+\$?([\d,]+(?:\.\d{2})?))?/g);
  const items: Array<{name: string; quantity?: number; unitPrice?: number; total?: number}> = [];
  
  if (itemMatches) {
    itemMatches.forEach(match => {
      const parts = match.match(/(\d+)\s+([a-zA-Z\s]+?)(?:\s+at\s+\$?([\d,]+(?:\.\d{2})?))?/);
      if (parts) {
        const quantity = parseInt(parts[1]);
        const name = parts[2].trim();
        const unitPrice = parts[3] ? parseFloat(parts[3].replace(',', '')) : undefined;
        items.push({
          name,
          quantity,
          unitPrice,
          total: unitPrice ? quantity * unitPrice : undefined,
        });
      }
    });
  }
  
  // If no specific items found, try to extract general item description
  if (items.length === 0) {
    const forItemMatch = message.match(/for\s+([^$]+?)(?:\s+worth|\s+for|\s*$)/i);
    if (forItemMatch && !customer) {
      // This might be an item description
      const itemDesc = forItemMatch[1].trim();
      items.push({
        name: itemDesc,
        quantity: 1,
        unitPrice: totalAmount,
        total: totalAmount,
      });
    } else if (forItemMatch && customer) {
      // Extract item after customer name
      const afterCustomer = message.substring(message.toLowerCase().indexOf(customer.toLowerCase()) + customer.length);
      const itemMatch = afterCustomer.match(/for\s+([^$]+?)(?:\s+worth|\s+for|\s*$)/i);
      if (itemMatch) {
        items.push({
          name: itemMatch[1].trim(),
          quantity: 1,
          unitPrice: totalAmount,
          total: totalAmount,
        });
      }
    }
  }
  
  // Determine intent
  let intent: ParsedIntent['intent'] = 'general_inquiry';
  let confidence = 0.5;
  
  if (createKeywords.some(keyword => lowerMessage.includes(keyword))) {
    intent = 'create_estimate';
    confidence = 0.8;
  } else if (modifyKeywords.some(keyword => lowerMessage.includes(keyword))) {
    intent = 'modify_estimate';
    confidence = 0.7;
  } else if (confirmKeywords.some(keyword => lowerMessage.includes(keyword))) {
    intent = 'confirm_estimate';
    confidence = 0.9;
  }
  
  return {
    intent,
    entities: {
      customer,
      items: items.length > 0 ? items : undefined,
      totalAmount,
    },
    confidence,
  };
}

// Mock customer lookup
async function lookupCustomer(name: string) {
  // In real implementation, this would query the database
  const mockCustomers = [
    { id: '1', name: 'Acme Corp', email: 'billing@acme.com', phone: '555-0123' },
    { id: '2', name: 'Globex Industries', email: 'accounts@globex.com', phone: '555-0456' },
    { id: '3', name: 'Stark Industries', email: 'finance@stark.com', phone: '555-0789' },
  ];
  
  return mockCustomers.find(c => 
    c.name.toLowerCase().includes(name.toLowerCase()) ||
    name.toLowerCase().includes(c.name.toLowerCase())
  );
}

// Mock item lookup
async function lookupItem(name: string) {
  // In real implementation, this would query the database
  const mockItems = [
    { id: '1', name: 'Consulting Services', description: 'Professional consulting services', defaultPrice: 150 },
    { id: '2', name: 'Web Development', description: 'Custom web development', defaultPrice: 100 },
    { id: '3', name: 'Widget', description: 'Standard widget product', defaultPrice: 25 },
    { id: '4', name: 'Car Parts', description: 'Automotive parts and components', defaultPrice: 200 },
    { id: '5', name: 'Software License', description: 'Software licensing fee', defaultPrice: 500 },
  ];
  
  return mockItems.find(i => 
    i.name.toLowerCase().includes(name.toLowerCase()) ||
    name.toLowerCase().includes(i.name.toLowerCase())
  );
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

    const { message, conversationHistory, currentEstimate }: ChatRequest = await request.json();
    
    // Parse the user's intent
    const parsed = parseIntent(message);
    
    let response = '';
    let estimateData = currentEstimate;
    let suggestions: string[] = [];
    let actions: Array<{
      type: 'create_customer' | 'create_item' | 'confirm_estimate' | 'modify_estimate';
      label: string;
      data: any;
    }> = [];
    
    switch (parsed.intent) {
      case 'create_estimate':
        if (parsed.entities.customer) {
          // Look up customer
          const customer = await lookupCustomer(parsed.entities.customer);
          
          if (customer) {
            response = `Great! I found ${customer.name} in your customer database. `;
            estimateData = {
              customer: customer,
              items: [],
              totalAmount: 0,
            };
          } else {
            response = `I couldn't find a customer named "${parsed.entities.customer}" in your database. `;
            actions.push({
              type: 'create_customer',
              label: `Create customer "${parsed.entities.customer}"`,
              data: { name: parsed.entities.customer },
            });
            suggestions = [
              'Create a new customer',
              'Try a different customer name',
              'Show me existing customers',
            ];
          }
          
          // Process items
          if (parsed.entities.items) {
            const processedItems = [];
            const missingItems = [];
            
            for (const item of parsed.entities.items) {
              const foundItem = await lookupItem(item.name);
              
              if (foundItem) {
                processedItems.push({
                  id: foundItem.id,
                  name: foundItem.name,
                  description: foundItem.description,
                  quantity: item.quantity || 1,
                  unitPrice: item.unitPrice || foundItem.defaultPrice,
                  total: (item.quantity || 1) * (item.unitPrice || foundItem.defaultPrice),
                });
              } else {
                missingItems.push(item);
              }
            }
            
            if (processedItems.length > 0) {
              const totalAmount = processedItems.reduce((sum, item) => sum + item.total, 0);
              estimateData = {
                ...estimateData,
                items: processedItems,
                totalAmount,
              };
              response += `I found ${processedItems.length} item(s) and calculated a total of $${totalAmount}. `;
            }
            
            if (missingItems.length > 0) {
              response += `However, I couldn't find ${missingItems.length} item(s): ${missingItems.map(i => i.name).join(', ')}. `;
              missingItems.forEach(item => {
                actions.push({
                  type: 'create_item',
                  label: `Create item "${item.name}"`,
                  data: item,
                });
              });
            }
          }
          
          if (estimateData?.items?.length > 0) {
            response += 'Would you like to review the estimate or make any changes?';
            actions.push({
              type: 'confirm_estimate',
              label: 'Create this estimate',
              data: estimateData,
            });
            suggestions = [
              'Add another item',
              'Change the quantity',
              'Modify the price',
              'Add notes to the estimate',
            ];
          }
        } else {
          response = 'I\'d be happy to help you create an estimate! Which customer is this for?';
          suggestions = [
            'Create estimate for Acme Corp',
            'Show me existing customers',
            'Create estimate for new customer',
          ];
        }
        break;
        
      case 'modify_estimate':
        if (currentEstimate) {
          response = 'I can help you modify the current estimate. What would you like to change?';
          suggestions = [
            'Change customer',
            'Add an item',
            'Remove an item',
            'Update quantities',
            'Change prices',
            'Add notes',
          ];
        } else {
          response = 'There\'s no estimate to modify. Let\'s create a new one! What would you like to estimate?';
          suggestions = [
            'Create estimate for Acme Corp',
            'New estimate for consulting services',
          ];
        }
        break;
        
      case 'confirm_estimate':
        if (currentEstimate) {
          response = 'Perfect! I\'ll create the estimate for you now.';
          actions.push({
            type: 'confirm_estimate',
            label: 'Create Estimate',
            data: currentEstimate,
          });
        } else {
          response = 'There\'s no estimate to confirm. Let\'s create one! What would you like to estimate?';
        }
        break;
        
      default:
        response = 'I can help you create estimates using natural language. Try saying something like:\n\n• "Create an estimate for Acme Corp for consulting services worth $5000"\n• "I need a quote for John Smith for 10 widgets at $25 each"\n• "Generate an estimate for car parts totaling $3500"';
        suggestions = [
          'Create estimate for Acme Corp for consulting services worth $5000',
          'New estimate for 10 widgets at $25 each',
          'Quote for car parts worth $3500',
        ];
    }
    
    return NextResponse.json({
      message: response,
      metadata: {
        intent: parsed.intent,
        entities: parsed.entities,
        suggestions,
        actions,
      },
      estimateData,
    });
    
  } catch (error) {
    console.error('Error in AI chat:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}