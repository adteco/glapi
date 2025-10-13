/**
 * AI Chat Component
 * A complete React component for AI-powered chat interactions
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Bot, User, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tool?: {
    name: string;
    status: 'pending' | 'success' | 'error';
    result?: any;
  };
}

interface ChatConfig {
  mcpServerUrl: string;
  openAiApiKey: string;
  systemPrompt?: string;
}

export function ChatComponent({ config }: { config: ChatConfig }) {
  const { getToken, orgId } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [mcpSessionId, setMcpSessionId] = useState<string | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  /**
   * Initialize MCP session
   */
  const initializeMCPSession = async () => {
    try {
      const token = await getToken();
      
      const response = await fetch(config.mcpServerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Organization-Id': orgId || '',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'initialize',
          params: {
            protocolVersion: '0.1.0',
            capabilities: {},
          },
        }),
      });

      const result = await response.json();
      if (result.result) {
        setMcpSessionId(result.id);
        return true;
      }
      
      throw new Error(result.error?.message || 'Failed to initialize MCP session');
    } catch (error) {
      console.error('MCP initialization error:', error);
      toast.error('Failed to connect to AI service');
      return false;
    }
  };

  /**
   * Get available tools from MCP server
   */
  const getAvailableTools = async () => {
    try {
      const token = await getToken();
      
      const response = await fetch(config.mcpServerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Organization-Id': orgId || '',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/list',
        }),
      });

      const result = await response.json();
      return result.result?.tools || [];
    } catch (error) {
      console.error('Failed to get tools:', error);
      return [];
    }
  };

  /**
   * Execute a tool via MCP server
   */
  const executeTool = async (toolName: string, args: any) => {
    try {
      const token = await getToken();
      
      const response = await fetch(config.mcpServerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Organization-Id': orgId || '',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args,
          },
        }),
      });

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error.message);
      }
      
      return result.result;
    } catch (error) {
      console.error(`Tool execution error for ${toolName}:`, error);
      throw error;
    }
  };

  /**
   * Process user message with OpenAI
   */
  const processWithOpenAI = async (userMessage: string) => {
    try {
      // Get available tools
      const tools = await getAvailableTools();
      
      // Prepare messages for OpenAI
      const openAiMessages = [
        {
          role: 'system',
          content: config.systemPrompt || `You are a helpful AI assistant with access to various business management tools. 
          You can help users manage customers, vendors, employees, leads, prospects, and contacts.
          Always be concise and helpful. When using tools, explain what you're doing.`,
        },
        ...messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        {
          role: 'user',
          content: userMessage,
        },
      ];

      // Call OpenAI API
      const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.openAiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages: openAiMessages,
          tools: tools.map((tool: any) => ({
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.inputSchema,
            },
          })),
          tool_choice: 'auto',
        }),
      });

      const completion = await openAiResponse.json();
      
      if (completion.error) {
        throw new Error(completion.error.message);
      }

      const assistantMessage = completion.choices[0].message;
      
      // Handle tool calls
      if (assistantMessage.tool_calls) {
        const toolResults = [];
        
        for (const toolCall of assistantMessage.tool_calls) {
          const toolMessageId = Date.now().toString() + Math.random();
          
          // Add tool execution message
          setMessages(prev => [...prev, {
            id: toolMessageId,
            role: 'assistant',
            content: `Executing ${toolCall.function.name}...`,
            timestamp: new Date(),
            tool: {
              name: toolCall.function.name,
              status: 'pending',
            },
          }]);

          try {
            const args = JSON.parse(toolCall.function.arguments);
            const result = await executeTool(toolCall.function.name, args);
            
            // Update tool message with result
            setMessages(prev => prev.map(msg => 
              msg.id === toolMessageId 
                ? {
                    ...msg,
                    content: result.content[0].text,
                    tool: {
                      name: toolCall.function.name,
                      status: 'success',
                      result,
                    },
                  }
                : msg
            ));
            
            toolResults.push({
              tool_call_id: toolCall.id,
              content: result.content[0].text,
            });
          } catch (error) {
            // Update tool message with error
            setMessages(prev => prev.map(msg => 
              msg.id === toolMessageId 
                ? {
                    ...msg,
                    content: `Failed to execute ${toolCall.function.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    tool: {
                      name: toolCall.function.name,
                      status: 'error',
                    },
                  }
                : msg
            ));
          }
        }
        
        // Get final response from OpenAI with tool results
        const finalResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.openAiApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4-turbo-preview',
            messages: [
              ...openAiMessages,
              assistantMessage,
              ...toolResults.map(result => ({
                role: 'tool',
                tool_call_id: result.tool_call_id,
                content: result.content,
              })),
            ],
          }),
        });

        const finalCompletion = await finalResponse.json();
        return finalCompletion.choices[0].message.content;
      }
      
      return assistantMessage.content;
    } catch (error) {
      console.error('OpenAI processing error:', error);
      throw error;
    }
  };

  /**
   * Send a message
   */
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Add user message
    const userMessageId = Date.now().toString();
    setMessages(prev => [...prev, {
      id: userMessageId,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    }]);

    try {
      // Initialize MCP session if needed
      if (!mcpSessionId) {
        const initialized = await initializeMCPSession();
        if (!initialized) {
          throw new Error('Failed to initialize AI service');
        }
      }

      // Process with OpenAI
      const assistantResponse = await processWithOpenAI(userMessage);
      
      // Add assistant response
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: assistantResponse,
        timestamp: new Date(),
      }]);
    } catch (error) {
      console.error('Chat error:', error);
      
      // Add error message
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to process message'}`,
        timestamp: new Date(),
      }]);
      
      toast.error('Failed to process message');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Render a message
   */
  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';
    
    return (
      <div
        key={message.id}
        className={`flex gap-3 mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}
      >
        {!isUser && (
          <div className="flex-shrink-0">
            {isSystem ? (
              <AlertCircle className="h-8 w-8 text-orange-500" />
            ) : (
              <Bot className="h-8 w-8 text-blue-500" />
            )}
          </div>
        )}
        
        <div
          className={`max-w-[80%] rounded-lg px-4 py-2 ${
            isUser
              ? 'bg-blue-500 text-white'
              : isSystem
              ? 'bg-orange-50 text-orange-900 border border-orange-200'
              : 'bg-gray-100 text-gray-900'
          }`}
        >
          {message.tool && (
            <div className="flex items-center gap-2 mb-2 text-sm">
              {message.tool.status === 'pending' && (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Executing {message.tool.name}...</span>
                </>
              )}
              {message.tool.status === 'success' && (
                <>
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  <span className="text-green-600">Tool executed successfully</span>
                </>
              )}
              {message.tool.status === 'error' && (
                <>
                  <AlertCircle className="h-3 w-3 text-red-600" />
                  <span className="text-red-600">Tool execution failed</span>
                </>
              )}
            </div>
          )}
          
          <div className="whitespace-pre-wrap break-words">
            {message.content}
          </div>
          
          <div className="text-xs opacity-70 mt-1">
            {message.timestamp.toLocaleTimeString()}
          </div>
        </div>
        
        {isUser && (
          <div className="flex-shrink-0">
            <User className="h-8 w-8 text-gray-500" />
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader>
        <CardTitle>AI Assistant</CardTitle>
        <CardDescription>
          Ask me anything about your customers, vendors, employees, leads, prospects, or contacts
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              <Bot className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Start a conversation by typing a message below</p>
              <div className="mt-4 text-sm space-y-2">
                <p>Try asking:</p>
                <p className="italic">"Show me all active customers"</p>
                <p className="italic">"Create a new vendor called Acme Corp"</p>
                <p className="italic">"Find leads with score above 70"</p>
              </div>
            </div>
          ) : (
            messages.map(renderMessage)
          )}
          
          {isLoading && (
            <div className="flex gap-3 mb-4">
              <Bot className="h-8 w-8 text-blue-500" />
              <div className="bg-gray-100 rounded-lg px-4 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </ScrollArea>
        
        <div className="border-t p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}