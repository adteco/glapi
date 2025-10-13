import { EstimateChat } from '@/components/chat/estimate-chat';
import { ChatExamples } from '@/components/chat/chat-examples';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function EstimateChatPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">AI Estimate Assistant</h1>
        <p className="text-muted-foreground">
          Create estimates using natural language. Just describe what you need and let AI guide you through the process.
        </p>
      </div>
      
      <Tabs defaultValue="chat" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="chat">Chat Interface</TabsTrigger>
          <TabsTrigger value="examples">How It Works</TabsTrigger>
        </TabsList>
        
        <TabsContent value="chat" className="mt-6">
          <EstimateChat />
        </TabsContent>
        
        <TabsContent value="examples" className="mt-6">
          <ChatExamples />
        </TabsContent>
      </Tabs>
    </div>
  );
}