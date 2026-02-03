'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Send,
  Bot,
  User,
  CheckCircle,
  AlertCircle,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  MessageSquare,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePostHog } from 'posthog-js/react';

// ============================================================================
// Types
// ============================================================================

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: MessageMetadata;
}

interface MessageMetadata {
  intentId?: string;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
  pendingActionId?: string;
  success?: boolean;
  error?: string;
  suggestions?: string[];
  warnings?: string[];
}

interface PendingActionData {
  id: string;
  toolName?: string;
  parameters?: Record<string, unknown>;
  intent?: {
    id: string;
    name: string;
  };
}

interface ConfirmationState {
  isOpen: boolean;
  message: string;
  riskLevel: string;
  pendingActionId: string;
  pendingAction?: PendingActionData;
}

// ============================================================================
// Component
// ============================================================================

export function ConversationalLedger() {
  const posthog = usePostHog();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        "Hi! I'm your GLAPI assistant. I can help you manage customers, vendors, invoices, journal entries, and more. What would you like to do?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    isOpen: false,
    message: '',
    riskLevel: '',
    pendingActionId: '',
    pendingAction: undefined,
  });
  const [conversationId] = useState(() => `conv_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Track conversation start
  useEffect(() => {
    if (isOpen) {
      posthog?.capture('conversational_ledger_opened', {
        conversationId,
      });
    }
  }, [isOpen, conversationId, posthog]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Track message sent
    posthog?.capture('conversational_ledger_message_sent', {
      conversationId,
      messageLength: userMessage.content.length,
    });

    try {
      const response = await fetch('/api/chat/ledger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversationId,
          conversationHistory: messages.slice(-10), // Last 10 messages for context
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to get AI response');
      }

      const data = await response.json();

      // Track response received
      posthog?.capture('conversational_ledger_response_received', {
        conversationId,
        intentId: data.metadata?.intentId,
        riskLevel: data.metadata?.riskLevel,
        success: data.metadata?.success,
        requiresConfirmation: data.metadata?.requiresConfirmation,
      });

      // Handle confirmation requirement
      if (data.metadata?.requiresConfirmation && data.metadata?.pendingActionId) {
        // Get the full pending action from pendingConfirmations array
        const pendingAction = data.metadata?.pendingConfirmations?.find(
          (p: PendingActionData) => p.id === data.metadata.pendingActionId
        );
        setConfirmation({
          isOpen: true,
          message: data.metadata.confirmationMessage || data.message,
          riskLevel: data.metadata.riskLevel || 'MEDIUM',
          pendingActionId: data.metadata.pendingActionId,
          pendingAction,
        });
      }

      const assistantMessage: Message = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        metadata: data.metadata,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error calling AI chat:', error);

      // Track error
      posthog?.capture('conversational_ledger_error', {
        conversationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      const errorMessage: Message = {
        id: `msg_${Date.now() + 1}`,
        role: 'system',
        content:
          error instanceof Error
            ? error.message
            : 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
        metadata: { error: 'true' },
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirmation.pendingActionId) return;

    setConfirmation((prev) => ({ ...prev, isOpen: false }));
    setIsLoading(true);

    // Track confirmation
    posthog?.capture('conversational_ledger_action_confirmed', {
      conversationId,
      pendingActionId: confirmation.pendingActionId,
      riskLevel: confirmation.riskLevel,
    });

    try {
      const response = await fetch('/api/chat/ledger/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId,
          pendingActionId: confirmation.pendingActionId,
          // Include full action data for serverless environments
          pendingAction: confirmation.pendingAction,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to confirm action');
      }

      const data = await response.json();

      const resultMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        metadata: {
          success: data.success,
          intentId: data.intentId,
        },
      };

      setMessages((prev) => [...prev, resultMessage]);

      // Track action result
      posthog?.capture('conversational_ledger_action_completed', {
        conversationId,
        success: data.success,
        intentId: data.intentId,
      });
    } catch (error) {
      console.error('Error confirming action:', error);

      const errorMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'system',
        content:
          error instanceof Error
            ? error.message
            : 'Failed to complete the action. Please try again.',
        timestamp: new Date(),
        metadata: { error: 'true' },
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirmation.pendingActionId) return;

    // Track cancellation
    posthog?.capture('conversational_ledger_action_cancelled', {
      conversationId,
      pendingActionId: confirmation.pendingActionId,
      riskLevel: confirmation.riskLevel,
    });

    try {
      await fetch('/api/chat/ledger/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId,
          pendingActionId: confirmation.pendingActionId,
        }),
      });
    } catch (error) {
      console.error('Error cancelling action:', error);
    }

    setConfirmation({
      isOpen: false,
      message: '',
      riskLevel: '',
      pendingActionId: '',
      pendingAction: undefined,
    });

    const cancelMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'system',
      content: 'Action cancelled.',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, cancelMessage]);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
  };

  const getRiskIcon = (riskLevel?: string) => {
    switch (riskLevel) {
      case 'CRITICAL':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'HIGH':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'MEDIUM':
        return <ShieldCheck className="w-4 h-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  // Floating button when closed
  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
      >
        <MessageSquare className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <>
      {/* Chat Window */}
      <Card className="fixed bottom-6 right-6 w-96 h-[600px] flex flex-col shadow-xl z-50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="w-5 h-5" />
            GLAPI Assistant
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 space-y-4 min-h-0">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex items-start gap-2',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role !== 'user' && (
                  <Avatar className="w-7 h-7">
                    <AvatarFallback className="text-xs">
                      {message.role === 'assistant' ? (
                        <Bot className="w-3 h-3" />
                      ) : (
                        <AlertCircle className="w-3 h-3" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                )}

                <div
                  className={cn(
                    'max-w-[80%] rounded-lg p-2.5 text-sm',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : message.role === 'assistant'
                      ? 'bg-muted'
                      : 'bg-yellow-50 border border-yellow-200 text-yellow-900'
                  )}
                >
                  {/* Risk indicator */}
                  {message.metadata?.riskLevel && (
                    <div className="flex items-center gap-1 mb-1">
                      {getRiskIcon(message.metadata.riskLevel)}
                      <span className="text-xs opacity-70">
                        {message.metadata.riskLevel} risk
                      </span>
                    </div>
                  )}

                  <p className="whitespace-pre-wrap">{message.content}</p>

                  {/* Warnings */}
                  {message.metadata?.warnings?.map((warning, i) => (
                    <div
                      key={i}
                      className="mt-2 flex items-start gap-1 text-xs text-yellow-700 bg-yellow-50 rounded p-1.5"
                    >
                      <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>{warning}</span>
                    </div>
                  ))}

                  {/* Suggestions */}
                  {message.metadata?.suggestions && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {message.metadata.suggestions.map((suggestion, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="cursor-pointer hover:bg-secondary/80 text-xs"
                          onClick={() => handleSuggestionClick(suggestion)}
                        >
                          {suggestion}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Success/error indicator */}
                  {message.metadata?.success !== undefined && (
                    <div className="mt-2 flex items-center gap-1 text-xs">
                      {message.metadata.success ? (
                        <>
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          <span className="text-green-700">Completed</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3 h-3 text-red-500" />
                          <span className="text-red-700">Failed</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {message.role === 'user' && (
                  <Avatar className="w-7 h-7">
                    <AvatarFallback className="text-xs">
                      <User className="w-3 h-3" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex items-start gap-2">
                <Avatar className="w-7 h-7">
                  <AvatarFallback className="text-xs">
                    <Bot className="w-3 h-3" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-lg p-2.5">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions */}
          <div className="px-4 py-2 border-t">
            <div className="flex gap-1 overflow-x-auto text-xs">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs flex-shrink-0"
                onClick={() => setInputValue('List customers')}
              >
                Customers
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs flex-shrink-0"
                onClick={() => setInputValue('Show invoices')}
              >
                Invoices
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs flex-shrink-0"
                onClick={() => setInputValue('Generate balance sheet')}
              >
                Reports
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs flex-shrink-0"
                onClick={() => setInputValue('What can you do?')}
              >
                <HelpCircle className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-4 pt-2 border-t">
            <div className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask me anything..."
                disabled={isLoading}
                className="flex-1 text-sm"
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !inputValue.trim()}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmation.isOpen}
        onOpenChange={(open) => {
          if (!open) handleCancel();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmation.riskLevel === 'CRITICAL' && (
                <AlertTriangle className="w-5 h-5 text-red-500" />
              )}
              {confirmation.riskLevel === 'HIGH' && (
                <AlertCircle className="w-5 h-5 text-orange-500" />
              )}
              {confirmation.riskLevel === 'MEDIUM' && (
                <ShieldCheck className="w-5 h-5 text-yellow-500" />
              )}
              Confirm Action
            </DialogTitle>
            <DialogDescription className="pt-2">
              {confirmation.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              variant={
                confirmation.riskLevel === 'CRITICAL' ? 'destructive' : 'default'
              }
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
