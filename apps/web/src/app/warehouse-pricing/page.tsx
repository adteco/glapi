'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { WarehousePriceLookup } from '@/components/warehouse-price-lookup';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

interface Customer {
  id: string;
  name: string;
  code: string;
}

interface Item {
  id: string;
  itemCode: string;
  name: string;
}

export default function WarehousePricingPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { getToken, orgId } = useAuth();

  // Fetch customers
  useEffect(() => {
    const fetchCustomers = async () => {
      if (!orgId) return;
      
      try {
        const token = await getToken();
        if (!token) return;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/customers?limit=100`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.error('Failed to fetch customers');
          return;
        }

        const data = await response.json();
        setCustomers(data.data || []);
      } catch (error) {
        console.error('Error fetching customers:', error);
        toast.error('Failed to load customers');
      }
    };

    fetchCustomers();
  }, [orgId, getToken]);

  // Fetch items
  useEffect(() => {
    const fetchItems = async () => {
      if (!orgId) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      try {
        const token = await getToken();
        if (!token) {
          setIsLoading(false);
          return;
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/items?activeOnly=true&limit=100`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.error('Failed to fetch items');
          return;
        }

        const data = await response.json();
        setItems(data.data || []);
      } catch (error) {
        console.error('Error fetching items:', error);
        toast.error('Failed to load items');
      } finally {
        setIsLoading(false);
      }
    };

    fetchItems();
  }, [orgId, getToken]);

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Building2 className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Warehouse Pricing</h1>
        </div>
        <p className="text-muted-foreground">
          Manage warehouse-based pricing for customers and look up prices based on warehouse assignments.
        </p>
      </div>

      <Tabs defaultValue="lookup" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="lookup">Price Lookup</TabsTrigger>
          <TabsTrigger value="how-it-works">How It Works</TabsTrigger>
        </TabsList>
        
        <TabsContent value="lookup" className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-10">
                <div className="text-center text-muted-foreground">
                  Loading data...
                </div>
              </CardContent>
            </Card>
          ) : (
            <WarehousePriceLookup customers={customers} items={items} />
          )}
        </TabsContent>
        
        <TabsContent value="how-it-works" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>How Warehouse Pricing Works</CardTitle>
              <CardDescription>
                Understanding the warehouse-based pricing system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">1. Warehouse Setup</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Create warehouses to represent different physical locations or pricing regions.
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Each warehouse can have multiple price lists assigned</li>
                  <li>Price lists are prioritized (1 is highest priority)</li>
                  <li>Price lists can have effective and expiration dates</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">2. Customer-Item-Warehouse Assignment</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Assign customers to specific warehouses for each item they purchase.
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Each customer can have different warehouses for different items</li>
                  <li>Assignments can have effective and expiration dates</li>
                  <li>One assignment can be marked as default per customer</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">3. Price Calculation</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  When looking up a price, the system follows this logic:
                </p>
                <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                  <li>Find the customer&apos;s warehouse assignment for the item</li>
                  <li>Get all price lists for that warehouse (ordered by priority)</li>
                  <li>Search each price list for the item&apos;s price</li>
                  <li>Apply quantity breaks if applicable</li>
                  <li>Return the first matching price found</li>
                </ol>
              </div>

              <div className="rounded-lg bg-primary/10 p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Example Scenario
                </h3>
                <p className="text-sm">
                  Customer &quot;ABC Corp&quot; is assigned to &quot;East Coast Warehouse&quot; for &quot;Widget A&quot;.
                  The East Coast Warehouse has two price lists: &quot;Standard Pricing&quot; (priority 1) and 
                  &quot;Discount Pricing&quot; (priority 2). The system will first check Standard Pricing for Widget A,
                  and if not found, will check Discount Pricing.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">4. Benefits</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Different pricing for different regions or warehouses</li>
                  <li>Customer-specific warehouse assignments for flexibility</li>
                  <li>Date-based pricing for promotions or seasonal rates</li>
                  <li>Priority-based price list fallback logic</li>
                  <li>Multi-tenant support with organization isolation</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}