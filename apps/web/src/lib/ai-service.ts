import OpenAI from 'openai';

// MCP tool definitions
const MCP_TOOLS = [
  // Customer tools
  {
    type: 'function' as const,
    function: {
      name: 'list_customers',
      description: 'Retrieve and search customer records with optional filtering',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search term for customer name or email',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'all'],
            description: 'Filter by customer status',
            default: 'active',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of customers to return',
            default: 50,
            minimum: 1,
            maximum: 100,
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_customer',
      description: 'Get detailed information for a specific customer',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Customer ID (UUID)',
          },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_customer',
      description: 'Create a new customer record',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Customer name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Customer email address',
          },
          phone: {
            type: 'string',
            description: 'Customer phone number',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_customer',
      description: 'Update an existing customer record',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Customer ID (UUID)',
          },
          name: {
            type: 'string',
            description: 'Customer name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Customer email address',
          },
          phone: {
            type: 'string',
            description: 'Customer phone number',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'archived'],
            description: 'Customer status',
          },
        },
        required: ['id'],
      },
    },
  },
  // Vendor tools
  {
    type: 'function' as const,
    function: {
      name: 'list_vendors',
      description: 'Retrieve and search vendor records with optional filtering',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search term for vendor name or email',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'all'],
            description: 'Filter by vendor status',
            default: 'active',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of vendors to return',
            default: 50,
            minimum: 1,
            maximum: 100,
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_vendor',
      description: 'Get detailed information for a specific vendor',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Vendor ID (UUID)',
          },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_vendor',
      description: 'Create a new vendor record',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Vendor name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Vendor email address',
          },
          phone: {
            type: 'string',
            description: 'Vendor phone number',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_vendor',
      description: 'Update an existing vendor record',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Vendor ID (UUID)',
          },
          name: {
            type: 'string',
            description: 'Vendor name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Vendor email address',
          },
          phone: {
            type: 'string',
            description: 'Vendor phone number',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'archived'],
            description: 'Vendor status',
          },
        },
        required: ['id'],
      },
    },
  },
  // Employee tools
  {
    type: 'function' as const,
    function: {
      name: 'list_employees',
      description: 'Retrieve and search employee records with optional filtering',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search term for employee name or email',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'all'],
            description: 'Filter by employee status',
            default: 'active',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of employees to return',
            default: 50,
            minimum: 1,
            maximum: 100,
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_employee',
      description: 'Get detailed information for a specific employee',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Employee ID (UUID)',
          },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_employee',
      description: 'Create a new employee record',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Employee name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Employee email address',
          },
          phone: {
            type: 'string',
            description: 'Employee phone number',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_employee',
      description: 'Update an existing employee record',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Employee ID (UUID)',
          },
          name: {
            type: 'string',
            description: 'Employee name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Employee email address',
          },
          phone: {
            type: 'string',
            description: 'Employee phone number',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'archived'],
            description: 'Employee status',
          },
        },
        required: ['id'],
      },
    },
  },
  // Lead tools
  {
    type: 'function' as const,
    function: {
      name: 'list_leads',
      description: 'Retrieve and search lead records with optional filtering',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search term for lead name or email',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'all'],
            description: 'Filter by lead status',
            default: 'active',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of leads to return',
            default: 50,
            minimum: 1,
            maximum: 100,
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_lead',
      description: 'Get detailed information for a specific lead',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Lead ID (UUID)',
          },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_lead',
      description: 'Create a new lead record',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Lead name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Lead email address',
          },
          phone: {
            type: 'string',
            description: 'Lead phone number',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_lead',
      description: 'Update an existing lead record',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Lead ID (UUID)',
          },
          name: {
            type: 'string',
            description: 'Lead name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Lead email address',
          },
          phone: {
            type: 'string',
            description: 'Lead phone number',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'archived'],
            description: 'Lead status',
          },
        },
        required: ['id'],
      },
    },
  },
  // Prospect tools
  {
    type: 'function' as const,
    function: {
      name: 'list_prospects',
      description: 'Retrieve and search prospect records with optional filtering',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search term for prospect name or email',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'all'],
            description: 'Filter by prospect status',
            default: 'active',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of prospects to return',
            default: 50,
            minimum: 1,
            maximum: 100,
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_prospect',
      description: 'Get detailed information for a specific prospect',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Prospect ID (UUID)',
          },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_prospect',
      description: 'Create a new prospect record',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Prospect name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Prospect email address',
          },
          phone: {
            type: 'string',
            description: 'Prospect phone number',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_prospect',
      description: 'Update an existing prospect record',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Prospect ID (UUID)',
          },
          name: {
            type: 'string',
            description: 'Prospect name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Prospect email address',
          },
          phone: {
            type: 'string',
            description: 'Prospect phone number',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'archived'],
            description: 'Prospect status',
          },
        },
        required: ['id'],
      },
    },
  },
  // Contact tools
  {
    type: 'function' as const,
    function: {
      name: 'list_contacts',
      description: 'Retrieve and search contact records with optional filtering',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search term for contact name or email',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'all'],
            description: 'Filter by contact status',
            default: 'active',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of contacts to return',
            default: 50,
            minimum: 1,
            maximum: 100,
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_contact',
      description: 'Get detailed information for a specific contact',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Contact ID (UUID)',
          },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_contact',
      description: 'Create a new contact record',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Contact name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Contact email address',
          },
          phone: {
            type: 'string',
            description: 'Contact phone number',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_contact',
      description: 'Update an existing contact record',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Contact ID (UUID)',
          },
          name: {
            type: 'string',
            description: 'Contact name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Contact email address',
          },
          phone: {
            type: 'string',
            description: 'Contact phone number',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'archived'],
            description: 'Contact status',
          },
        },
        required: ['id'],
      },
    },
  },
];

export class AIService {
  private openai: OpenAI;
  private mcpServerUrl: string;
  private mcpInitialized = false;

  constructor(apiKey: string, mcpServerUrl: string) {
    this.openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true, // For demo purposes - in production use a backend proxy
    });
    this.mcpServerUrl = mcpServerUrl;
  }

  private async initializeMCP(): Promise<void> {
    if (this.mcpInitialized) return;

    try {
      const response = await fetch(this.mcpServerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'GLAPI Chat',
              version: '1.0.0',
            },
          },
        }),
      });

      const result = await response.json();
      console.log('[AI Service] MCP initialization result:', result);
      
      if (result.error) {
        throw new Error(`MCP initialization failed: ${result.error.message}`);
      }

      this.mcpInitialized = true;
    } catch (error) {
      console.error('[AI Service] Failed to initialize MCP:', error);
      throw error;
    }
  }

  async processMessage(
    message: string,
    conversationHistory: { role: 'user' | 'assistant'; content: string }[],
    authToken: string
  ): Promise<string> {
    try {
      const messages = [
        {
          role: 'system' as const,
          content: `You are a helpful AI assistant for the GLAPI business management system. 
You can help users with tasks like managing customers, vendors, employees, leads, prospects, contacts, 
creating invoices, generating reports, and handling inventory. You have access to tools that allow you 
to interact with the system.

Available relationship management capabilities:
- Customers: list, view, create, update customer records
- Vendors: list, view, create, update vendor records
- Employees: list, view, create, update employee records
- Leads: list, view, create, update lead records
- Prospects: list, view, create, update prospect records
- Contacts: list, view, create, update contact records

When users ask you to perform actions, use the available tools to help them.
Be professional, concise, and helpful in your responses.`,
        },
        ...conversationHistory,
        { role: 'user' as const, content: message },
      ];

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-0125-preview',
        messages,
        tools: MCP_TOOLS,
        tool_choice: 'auto',
      });

      const responseMessage = response.choices[0].message;

      // Check if the model wants to use tools
      if (responseMessage.tool_calls) {
        const toolResults = await Promise.all(
          responseMessage.tool_calls.map(async (toolCall) => {
            try {
              const result = await this.callMCPTool(
                toolCall.function.name,
                JSON.parse(toolCall.function.arguments),
                authToken
              );
              return {
                tool_call_id: toolCall.id,
                content: JSON.stringify(result),
              };
            } catch (error) {
              return {
                tool_call_id: toolCall.id,
                content: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
              };
            }
          })
        );

        // Get the final response with tool results
        const finalResponse = await this.openai.chat.completions.create({
          model: 'gpt-4-0125-preview',
          messages: [
            ...messages,
            responseMessage,
            ...toolResults.map((result) => ({
              role: 'tool' as const,
              content: result.content,
              tool_call_id: result.tool_call_id,
            })),
          ],
        });

        return finalResponse.choices[0].message.content || 'I completed the task successfully.';
      }

      return responseMessage.content || "I'm not sure how to help with that.";
    } catch (error) {
      console.error('AI processing error:', error);
      return "I'm sorry, I encountered an error while processing your request. Please try again.";
    }
  }

  private async callMCPTool(toolName: string, args: any, authToken: string): Promise<any> {
    console.log('[AI Service] Calling MCP tool:', toolName, 'with args:', args);
    console.log('[AI Service] MCP Server URL:', this.mcpServerUrl);
    
    // Ensure MCP is initialized
    await this.initializeMCP();
    
    const requestBody = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    };
    
    console.log('[AI Service] Request body:', JSON.stringify(requestBody, null, 2));
    
    try {
      const response = await fetch(this.mcpServerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('[AI Service] Response status:', response.status);
      const responseText = await response.text();
      console.log('[AI Service] Response text:', responseText);

      if (!response.ok) {
        throw new Error(`MCP server returned ${response.status}: ${response.statusText} - ${responseText}`);
      }

      const result = JSON.parse(responseText);
      console.log('[AI Service] Parsed result:', result);

      if (result.error) {
        throw new Error(`MCP Error: ${result.error.message}`);
      }

      return result.result;
    } catch (error) {
      console.error('[AI Service] Error calling MCP tool:', error);
      
      // Check if it's a connection error (MCP server not running)
      if (error instanceof TypeError && error.message.includes('fetch failed')) {
        throw new Error('MCP server is not running. Please ensure the MCP server is started on ' + this.mcpServerUrl);
      }
      throw error;
    }
  }
}