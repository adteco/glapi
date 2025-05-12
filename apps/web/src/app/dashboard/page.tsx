'use client';

import DashboardShadcn from '@/components/DashboardShadcn';
import CustomersWidgetShadcn from './customers-widget-shadcn';
import SubsidiariesWidgetShadcn from './subsidiaries-widget-shadcn';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, CalendarDays, LineChart, PlusCircle, Laptop, Smartphone, MousePointerClick } from "lucide-react";

const DashboardPage = () => {
  // Replace the old Dashboard component with our shadcn-themed components
  return (
    <div className="space-y-8">
      <div className="flex flex-col">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Welcome to your GLAPI application dashboard
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CustomersWidgetShadcn />
        </Card>

        <Card>
          <SubsidiariesWidgetShadcn />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your recent system activities</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-2 rounded-full">
                <Laptop className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">New subsidiary added</p>
                <p className="text-sm text-muted-foreground">Today, 10:35 AM</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-2 rounded-full">
                <MousePointerClick className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Customer updated</p>
                <p className="text-sm text-muted-foreground">Yesterday, 2:15 PM</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-2 rounded-full">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">New user joined</p>
                <p className="text-sm text-muted-foreground">May 9, 2025</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full">
              <CalendarDays className="mr-2 h-4 w-4" />
              View All Activity
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Frequently used actions</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Button className="justify-start">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
            <Button variant="secondary" className="justify-start">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Subsidiary
            </Button>
            <Button variant="outline" className="justify-start">
              <BarChart className="mr-2 h-4 w-4" />
              Generate Report
            </Button>
            <Button variant="outline" className="justify-start">
              <LineChart className="mr-2 h-4 w-4" />
              View Analytics
            </Button>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Current system metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">API Health</p>
                  <p className="text-sm text-green-500 dark:text-green-400">Operational</p>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="bg-green-500 h-full w-full" style={{ width: "100%" }}></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Database</p>
                  <p className="text-sm text-green-500 dark:text-green-400">Operational</p>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="bg-green-500 h-full" style={{ width: "100%" }}></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Authentication</p>
                  <p className="text-sm text-green-500 dark:text-green-400">Operational</p>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="bg-green-500 h-full" style={{ width: "100%" }}></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
