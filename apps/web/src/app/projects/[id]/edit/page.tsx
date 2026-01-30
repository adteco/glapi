'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const projectStatusEnum = z.enum([
  'planning',
  'active',
  'on_hold',
  'completed',
  'cancelled',
  'archived',
]);

const projectSchema = z.object({
  projectCode: z.string().min(1, 'Project code is required').max(50),
  name: z.string().min(1, 'Project name is required').max(200),
  status: projectStatusEnum,
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  jobNumber: z.string().max(50).optional(),
  projectType: z.string().max(50).optional(),
  customerId: z.string().uuid().optional().nullable(),
  budgetRevenue: z.string().optional(),
  budgetCost: z.string().optional(),
  description: z.string().max(2000).optional(),
  currencyCode: z.string().max(10).optional(),
  retainagePercent: z.string().optional(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

const statusOptions = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'archived', label: 'Archived' },
];

export default function EditProjectPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { orgId } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      projectCode: '',
      name: '',
      status: 'planning',
      startDate: '',
      endDate: '',
      jobNumber: '',
      projectType: '',
      customerId: null,
      budgetRevenue: '',
      budgetCost: '',
      description: '',
      currencyCode: '',
      retainagePercent: '',
    },
  });

  // Fetch customers for selection
  const { data: customers = [] } = trpc.customers.list.useQuery(
    {},
    { enabled: !!orgId }
  );

  // Fetch project data
  const { data: project, isLoading: projectLoading } = trpc.projects.get.useQuery(
    { id },
    {
      enabled: !!orgId && !!id,
      retry: 1,
    }
  );

  // Update mutation
  const updateMutation = trpc.projects.update.useMutation({
    onSuccess: () => {
      toast.success('Project updated successfully');
      router.push(`/projects/${id}`);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update project');
    },
  });

  // Populate form when project data is loaded
  useEffect(() => {
    if (project) {
      const formatDateForInput = (dateStr: string | Date | null | undefined): string => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toISOString().split('T')[0];
      };

      form.reset({
        projectCode: project.projectCode || '',
        name: project.name || '',
        status: (project.status as ProjectFormValues['status']) || 'planning',
        startDate: formatDateForInput(project.startDate),
        endDate: formatDateForInput(project.endDate),
        jobNumber: project.jobNumber || '',
        projectType: project.projectType || '',
        customerId: project.customerId || null,
        budgetRevenue: project.budgetRevenue || '',
        budgetCost: project.budgetCost || '',
        description: project.description || '',
        currencyCode: project.currencyCode || '',
        retainagePercent: project.retainagePercent || '',
      });
    }
  }, [project, form]);

  const onSubmit = async (values: ProjectFormValues) => {
    setIsLoading(true);
    try {
      await updateMutation.mutateAsync({
        id,
        data: {
          projectCode: values.projectCode,
          name: values.name,
          status: values.status,
          startDate: values.startDate || null,
          endDate: values.endDate || null,
          jobNumber: values.jobNumber || null,
          projectType: values.projectType || null,
          customerId: values.customerId || null,
          budgetRevenue: values.budgetRevenue || null,
          budgetCost: values.budgetCost || null,
          description: values.description || null,
          currencyCode: values.currencyCode || null,
          retainagePercent: values.retainagePercent || undefined,
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to edit project.</p>
      </div>
    );
  }

  if (projectLoading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        </div>
        <Card>
          <CardHeader>
            <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
              <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
              <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Project Not Found</h1>
        </div>
        <p className="text-muted-foreground">The project you're trying to edit doesn't exist or you don't have access to it.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">Edit Project</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Information</CardTitle>
          <CardDescription>Update the project details below</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="projectCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Code *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., PRJ-001" />
                      </FormControl>
                      <FormDescription>Unique identifier for the project</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {statusOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="projectType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Type</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Construction, Consulting" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                        value={field.value || 'none'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Customer</SelectItem>
                          {customers.filter(c => c.id).map(customer => (
                            <SelectItem key={customer.id} value={customer.id!}>
                              {customer.companyName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="budgetRevenue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget Revenue</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" placeholder="0.00" />
                      </FormControl>
                      <FormDescription>Total budgeted revenue for the project</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="budgetCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget Cost</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" placeholder="0.00" />
                      </FormControl>
                      <FormDescription>Total budgeted cost for the project</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="jobNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Number</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="currencyCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., USD" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="retainagePercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retainage %</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., 10" />
                      </FormControl>
                      <FormDescription>Percentage held as retainage</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={4}
                        placeholder="Project description..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <span className="mr-2">Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
