'use client';

import { useAuth } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { FileText, BarChart3, TrendingUp, Calendar, DollarSign, PieChart, Activity, Target, Building2, Wallet, Clock, Receipt } from 'lucide-react';
import Link from 'next/link';

export default function ReportsPage() {
  const { orgId } = useAuth();

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view reports.</p></div>;
  }

  const reportCategories = [
    {
      title: "Financial Reports",
      description: "Core financial statements and analysis",
      icon: <DollarSign className="h-8 w-8 text-blue-600" />,
      reports: [
        {
          name: "Balance Sheet",
          description: "Assets, liabilities, and equity at a point in time",
          href: "/reports/financial/balance-sheet",
          icon: <BarChart3 className="h-5 w-5" />
        },
        {
          name: "Income Statement",
          description: "Revenue, expenses, and profitability over a period",
          href: "/reports/financial/income-statement",
          icon: <TrendingUp className="h-5 w-5" />
        },
        {
          name: "Cash Flow Statement",
          description: "Cash inflows and outflows from operations, investing, and financing",
          href: "/reports/financial/cash-flow-statement",
          icon: <Activity className="h-5 w-5" />
        }
      ]
    },
    {
      title: "Construction & Projects",
      description: "Project health, WIP, and job cost analytics",
      icon: <Building2 className="h-8 w-8 text-amber-600" />,
      reports: [
        {
          name: "Job Cost Summary",
          description: "Budget vs actual, commitments, and percent complete by project",
          href: "/reports/construction/job-cost",
          icon: <TrendingUp className="h-5 w-5" />
        },
        {
          name: "WIP & Budget Analysis",
          description: "Work-in-progress clearing, commitments, and budget utilization",
          href: "/reports/construction/wip",
          icon: <Wallet className="h-5 w-5" />
        },
        {
          name: "Time Entries",
          description: "Track employee time, approvals, and labor costs by project",
          href: "/construction/time",
          icon: <Clock className="h-5 w-5" />
        },
        {
          name: "Expense Entries",
          description: "Manage expense reports, reimbursements, and billable costs",
          href: "/construction/expenses",
          icon: <Receipt className="h-5 w-5" />
        }
      ]
    },
    {
      title: "Transaction Reports",
      description: "Detailed transaction analysis and summaries",
      icon: <FileText className="h-8 w-8 text-green-600" />,
      reports: [
        {
          name: "Sales Summary",
          description: "Sales performance and trends analysis",
          href: "/reports/transactions/sales-summary",
          icon: <Target className="h-5 w-5" />
        },
        {
          name: "Purchase Summary",
          description: "Purchase orders and vendor analysis",
          href: "/reports/transactions/purchase-summary",
          icon: <PieChart className="h-5 w-5" />
        },
        {
          name: "Inventory Report",
          description: "Inventory levels, movements, and valuation",
          href: "/reports/transactions/inventory-report",
          icon: <BarChart3 className="h-5 w-5" />
        }
      ]
    },
    {
      title: "Budget Reports",
      description: "Budget vs actual analysis and variance reports",
      icon: <Calendar className="h-8 w-8 text-purple-600" />,
      reports: [
        {
          name: "Budget vs Actual",
          description: "Compare budgeted amounts with actual performance",
          href: "/reports/budgets/budget-vs-actual",
          icon: <BarChart3 className="h-5 w-5" />
        },
        {
          name: "Variance Analysis",
          description: "Detailed variance analysis by account and period",
          href: "/reports/budgets/variance-analysis",
          icon: <TrendingUp className="h-5 w-5" />
        },
        {
          name: "Budget Performance",
          description: "Overall budget performance metrics and KPIs",
          href: "/reports/budgets/budget-performance",
          icon: <Target className="h-5 w-5" />
        }
      ]
    }
  ];

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-gray-600 mt-2">Generate and view financial and operational reports</p>
        </div>
      </div>

      <div className="space-y-8">
        {reportCategories.map((category, categoryIndex) => (
          <div key={categoryIndex}>
            <div className="flex items-center gap-3 mb-4">
              {category.icon}
              <div>
                <h2 className="text-2xl font-semibold">{category.title}</h2>
                <p className="text-gray-600">{category.description}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {category.reports.map((report, reportIndex) => (
                <Card key={reportIndex} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <Link href={report.href}>
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          {report.icon}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{report.name}</CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm leading-relaxed">
                        {report.description}
                      </CardDescription>
                      <div className="mt-4">
                        <Button variant="outline" className="w-full">
                          View Report
                        </Button>
                      </div>
                    </CardContent>
                  </Link>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Access Section */}
      <div className="mt-12 bg-gray-50 rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4">Quick Access</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/reports/financial/balance-sheet">
            <Button variant="outline" className="w-full justify-start">
              <BarChart3 className="mr-2 h-4 w-4" />
              Latest Balance Sheet
            </Button>
          </Link>
          <Link href="/reports/financial/income-statement">
            <Button variant="outline" className="w-full justify-start">
              <TrendingUp className="mr-2 h-4 w-4" />
              Current Period P&L
            </Button>
          </Link>
          <Link href="/reports/financial/cash-flow-statement">
            <Button variant="outline" className="w-full justify-start">
              <Activity className="mr-2 h-4 w-4" />
              Cash Flow Analysis
            </Button>
          </Link>
        </div>
      </div>

      {/* Report Scheduler Section */}
      <div className="mt-8 border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold">Scheduled Reports</h3>
            <p className="text-gray-600">Automate report generation and delivery</p>
          </div>
          <Button>
            <Calendar className="mr-2 h-4 w-4" />
            Schedule Report
          </Button>
        </div>
        <div className="text-center py-8 text-gray-500">
          <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>No scheduled reports configured.</p>
          <p className="text-sm">Set up automated report generation to receive regular financial updates.</p>
        </div>
      </div>
    </div>
  );
}
