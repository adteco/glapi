'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Users, Package, FileText, Sparkles } from 'lucide-react';

export function ChatExamples() {
  const examples = [
    {
      icon: <MessageSquare className="w-5 h-5" />,
      title: "Natural Language Processing",
      description: "Understands your intent from natural language descriptions",
      examples: [
        "Create an estimate for Acme Corp for consulting services worth $5000",
        "I need a quote for John Smith for 10 widgets at $25 each",
        "Generate an estimate for car parts totaling $3500",
        "Make an estimate for Globex for web development services",
      ],
    },
    {
      icon: <Users className="w-5 h-5" />,
      title: "Smart Customer Management",
      description: "Automatically looks up customers and offers to create new ones",
      examples: [
        "If customer exists: 'Great! I found Acme Corp in your database'",
        "If customer doesn't exist: 'I couldn't find that customer. Would you like me to create them?'",
        "Suggests similar customer names if there's a partial match",
        "Handles customer creation through the conversation",
      ],
    },
    {
      icon: <Package className="w-5 h-5" />,
      title: "Intelligent Item Recognition",
      description: "Recognizes items and suggests alternatives when not found",
      examples: [
        "Matches 'consulting' to 'Consulting Services' in your catalog",
        "Recognizes quantities and pricing: '10 widgets at $25 each'",
        "Offers to create new items when they don't exist",
        "Calculates totals automatically",
      ],
    },
    {
      icon: <FileText className="w-5 h-5" />,
      title: "Guided Estimate Creation",
      description: "Walks you through the entire estimate process step-by-step",
      examples: [
        "Validates all required information is present",
        "Shows live preview of the estimate as you build it",
        "Asks clarifying questions when information is missing",
        "Provides actionable buttons for next steps",
      ],
    },
  ];

  const sampleConversation = [
    {
      type: 'user',
      message: "Create an estimate for Acme Corp for consulting services worth $5000",
    },
    {
      type: 'assistant',
      message: "Great! I found Acme Corp in your customer database. I found Consulting Services and calculated a total of $5000. Would you like to review the estimate or make any changes?",
      actions: ["Create this estimate", "Add another item", "Modify the price"],
    },
    {
      type: 'user',
      message: "Add 5 widgets at $25 each",
    },
    {
      type: 'assistant',
      message: "Perfect! I found widgets in your catalog and added 5 at $25 each ($125). Your new total is $5,125. Ready to create the estimate?",
      actions: ["Create estimate", "Add notes", "Change quantities"],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2 flex items-center justify-center gap-2">
          <Sparkles className="w-6 h-6 text-yellow-500" />
          AI-Powered Estimate Creation
        </h2>
        <p className="text-muted-foreground">
          Experience the future of estimate creation with our conversational AI assistant
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {examples.map((example, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {example.icon}
                {example.title}
              </CardTitle>
              <CardDescription>{example.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {example.examples.map((ex, i) => (
                  <div key={i} className="text-sm p-2 bg-muted rounded">
                    {ex}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Sample Conversation</CardTitle>
          <CardDescription>
            See how natural the conversation flow is
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sampleConversation.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.type === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm">{msg.message}</p>
                  {msg.actions && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {msg.actions.map((action, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {action}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">Try It Yourself!</CardTitle>
          <CardDescription className="text-blue-700">
            Start with any of these example phrases:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <div className="p-2 bg-white rounded border border-blue-200 text-sm">
              "Create an estimate for Acme Corp for consulting services worth $5000"
            </div>
            <div className="p-2 bg-white rounded border border-blue-200 text-sm">
              "I need a quote for John Smith for 10 widgets at $25 each"
            </div>
            <div className="p-2 bg-white rounded border border-blue-200 text-sm">
              "Generate an estimate for car parts totaling $3500"
            </div>
            <div className="p-2 bg-white rounded border border-blue-200 text-sm">
              "Make an estimate for web development services"
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}