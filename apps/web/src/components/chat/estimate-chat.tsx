'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Bot, User, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  status?: 'pending' | 'success' | 'error';
  metadata?: {
    intent?: string;
    entities?: Record<string, any>;
    suggestions?: string[];
    actions?: Array<{
      type: 'create_customer' | 'create_item' | 'confirm_estimate' | 'modify_estimate';
      label: string;
      data: any;
    }>;
  };
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

export function EstimateChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Hi! I can help you create estimates using natural language. Try saying something like "Create an estimate for Acme Corp for consulting services worth $5000" or "I need a quote for John Smith for 10 widgets at $25 each".',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [estimateData, setEstimateData] = useState<EstimateData | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Call the AI chat API
      const response = await fetch('/api/chat/estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory: messages,
          currentEstimate: estimateData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.message,
        timestamp: new Date(),
        metadata: data.metadata,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Update estimate data if provided
      if (data.estimateData) {
        setEstimateData(data.estimateData);
      }

    } catch (error) {
      console.error('Error calling AI chat:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'system',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
        status: 'error',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (action: ChatMessage['metadata']['actions'][0]) => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/chat/estimate/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          currentEstimate: estimateData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to execute action');
      }

      const data = await response.json();

      const systemMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'system',
        content: data.message,
        timestamp: new Date(),
        status: data.success ? 'success' : 'error',
      };

      setMessages(prev => [...prev, systemMessage]);

      if (data.estimateData) {
        setEstimateData(data.estimateData);
      }

    } catch (error) {
      console.error('Error executing action:', error);
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'system',
        content: 'Failed to execute action. Please try again.',
        timestamp: new Date(),
        status: 'error',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[800px] max-w-4xl mx-auto">
      {/* Chat Interface */}
      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            AI Estimate Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex items-start gap-3',
                  message.type === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.type !== 'user' && (
                  <Avatar className="w-8 h-8">
                    <AvatarFallback>
                      {message.type === 'assistant' ? (
                        <Bot className="w-4 h-4" />
                      ) : (
                        <AlertCircle className="w-4 h-4" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg p-3',
                    message.type === 'user'
                      ? 'bg-primary text-primary-foreground ml-auto'
                      : message.type === 'assistant'
                      ? 'bg-muted'
                      : 'bg-yellow-50 border border-yellow-200'
                  )}
                >
                  <p className="text-sm">{message.content}</p>
                  
                  {message.metadata?.suggestions && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {message.metadata.suggestions.map((suggestion, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="cursor-pointer hover:bg-secondary/80"
                          onClick={() => setInputValue(suggestion)}
                        >
                          {suggestion}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  {message.metadata?.actions && (
                    <div className="mt-2 space-y-1">
                      {message.metadata.actions.map((action, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          onClick={() => handleAction(action)}
                          disabled={isLoading}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  )}
                  
                  {message.status && (
                    <div className="mt-2 flex items-center gap-1 text-xs">
                      {message.status === 'success' && (
                        <CheckCircle className="w-3 h-3 text-green-500" />
                      )}
                      {message.status === 'error' && (
                        <AlertCircle className="w-3 h-3 text-red-500" />
                      )}
                      {message.status === 'pending' && (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                    </div>
                  )}
                </div>
                
                {message.type === 'user' && (
                  <Avatar className="w-8 h-8">
                    <AvatarFallback>
                      <User className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Input */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Describe the estimate you'd like to create..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !inputValue.trim()}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      {/* Estimate Preview */}
      {estimateData && (
        <Card className="w-80 ml-4">
          <CardHeader>
            <CardTitle className="text-lg">Estimate Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Customer */}
            <div>
              <h4 className="font-medium mb-2">Customer</h4>
              <div className="text-sm text-muted-foreground">
                <p>{estimateData.customer?.name}</p>
                {estimateData.customer?.email && (
                  <p>{estimateData.customer?.email}</p>
                )}
                {estimateData.customer?.phone && (
                  <p>{estimateData.customer?.phone}</p>
                )}
              </div>
            </div>
            
            <Separator />
            
            {/* Items */}
            <div>
              <h4 className="font-medium mb-2">Items</h4>
              <div className="space-y-2">
                {estimateData.items.map((item, index) => (
                  <div key={index} className="text-sm">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        {item.description && (
                          <p className="text-muted-foreground text-xs">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p>{item.quantity} × ${item.unitPrice}</p>
                        <p className="font-medium">${item.total}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <Separator />
            
            {/* Total */}
            <div className="flex justify-between items-center font-medium">
              <span>Total</span>
              <span>${estimateData.totalAmount}</span>
            </div>
            
            {/* Notes */}
            {estimateData.notes && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2">Notes</h4>
                  <p className="text-sm text-muted-foreground">
                    {estimateData.notes}
                  </p>
                </div>
              </>
            )}
            
            {/* Valid Until */}
            {estimateData.validUntil && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2">Valid Until</h4>
                  <p className="text-sm text-muted-foreground">
                    {estimateData.validUntil}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}