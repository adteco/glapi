'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Send,
  Bot,
  User,
  Loader2,
  MessageCircle,
  Zap,
  BarChart3,
  FileText,
  Users,
  Package,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AIService } from '@/lib/ai-service';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

const ChatPage = () => {
  const { orgId, getToken } = useAuth();
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hello! I'm your GLAPI assistant. I can help you with various tasks like:\n\n• Managing customers, vendors, employees, leads, prospects, and contacts\n• Creating and updating relationship records\n• Searching and filtering entity lists\n• Creating and sending invoices\n• Generating financial reports\n• Tracking inventory\n\nWhat would you like me to help you with today?",
      role: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize AI service
  const aiService = useMemo(() => {
    const openaiApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    const mcpServerUrl = process.env.NEXT_PUBLIC_MCP_SERVER_URL || 'http://localhost:8787';
    
    if (!openaiApiKey) {
      console.error('OpenAI API key not configured');
      return null;
    }
    
    return new AIService(openaiApiKey, mcpServerUrl);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to access the chat assistant.</p>
      </div>
    );
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || !aiService) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      // Get auth token
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      // Convert messages to format expected by AI service
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Get AI response
      const response = await aiService.processMessage(
        userMessage.content,
        conversationHistory,
        token
      );

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response,
        role: 'assistant',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
      
      // Add error message to chat
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I encountered an error. Please try again or contact support if the issue persists.",
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Show configuration error if AI service not available
  if (!aiService) {
    return (
      <div className="container mx-auto py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            AI service is not configured. Please set up the OpenAI API key in your environment variables.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const quickActions = [
    { icon: FileText, label: "Create Invoice", action: "Help me create a new invoice" },
    { icon: Users, label: "Add Customer", action: "I want to add a new customer" },
    { icon: BarChart3, label: "View Reports", action: "Show me financial reports" },
    { icon: Package, label: "Check Inventory", action: "I need to check inventory levels" }
  ];

  const handleQuickAction = (action: string) => {
    setInputValue(action);
  };

  return (
    <div className="container mx-auto py-6 h-[calc(100vh-8rem)]">
      <div className="flex flex-col h-full space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <MessageCircle className="h-8 w-8" />
              Chat Assistant
            </h1>
            <p className="text-gray-600">Your AI-powered business assistant for GLAPI operations</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Zap className="h-4 w-4" />
            <span>Powered by AI</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              variant="outline"
              className="h-auto p-4 flex flex-col items-center gap-2"
              onClick={() => handleQuickAction(action.action)}
            >
              <action.icon className="h-6 w-6" />
              <span className="text-sm font-medium">{action.label}</span>
            </Button>
          ))}
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Chat Container */}
        <Card className="flex-1 flex flex-col">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Chat History</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[70%] rounded-lg px-4 py-3",
                      message.role === 'user'
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-900"
                    )}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    <div
                      className={cn(
                        "text-xs mt-2",
                        message.role === 'user' ? "text-blue-100" : "text-gray-500"
                      )}
                    >
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                  {message.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-gray-100 rounded-lg px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask me anything about your business operations..."
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={isLoading || !inputValue.trim()}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                This assistant can help with customers, vendors, employees, leads, prospects, contacts, invoices, reports, inventory, and more business operations.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ChatPage;