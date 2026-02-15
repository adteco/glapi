'use client';

import LedgerUI from '@/components/revenue/ledger-ui';
import RevenueArchitecture from '@/components/revenue/revenue-architecture';
import RevenueRecognitionWorkbench from '@/components/revenue/revenue-recognition-workbench';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function RevenueRecognitionPage() {
  return (
    <Tabs defaultValue="live" className="space-y-4">
      <TabsList>
        <TabsTrigger value="live">Live Workbench</TabsTrigger>
        <TabsTrigger value="demo">Demo Ledger UI</TabsTrigger>
        <TabsTrigger value="architecture">Architecture</TabsTrigger>
      </TabsList>

      <TabsContent value="live">
        <RevenueRecognitionWorkbench />
      </TabsContent>

      <TabsContent value="demo">
        <LedgerUI initialView="contract" showHeader />
      </TabsContent>

      <TabsContent value="architecture">
        <RevenueArchitecture />
      </TabsContent>
    </Tabs>
  );
}
