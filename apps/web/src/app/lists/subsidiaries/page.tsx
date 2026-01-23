'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createSubsidiarySchema } from "@glapi/types";
import { z } from "zod";

// Define interfaces
interface Subsidiary {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  organizationId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Form schema - use centralized schema from @glapi/types
// Transform nullable strings to handle form inputs that don't accept null
const subsidiaryFormSchema = createSubsidiarySchema.omit({
  organizationId: true,
  parentId: true,
  isActive: true,
}).extend({
  code: z.string().optional(),
  description: z.string().optional(),
});

type SubsidiaryFormValues = z.infer<typeof subsidiaryFormSchema>;

export default function SubsidiariesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { orgId } = useAuth();
  
  // TRPC queries and mutations
  const { data: subsidiariesData, isLoading, refetch } = trpc.subsidiaries.list.useQuery({}, {
    enabled: !!orgId,
  });
  
  const createSubsidiaryMutation = trpc.subsidiaries.create.useMutation({
    onSuccess: () => {
      toast.success('Subsidiary created successfully');
      setIsDialogOpen(false);
      form.reset();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create subsidiary');
    },
  });

  const subsidiaries = subsidiariesData || [];

  const form = useForm<SubsidiaryFormValues>({
    resolver: zodResolver(subsidiaryFormSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
    },
  });

  // Handle form submission
  const handleCreateSubsidiary = async (values: SubsidiaryFormValues) => {
    createSubsidiaryMutation.mutate({
      name: values.name,
      code: values.code && values.code.trim() ? values.code.trim() : undefined,
      description: values.description && values.description.trim() ? values.description.trim() : undefined,
    });
  };

  if (isLoading) {
    return <div className="container mx-auto py-10"><p>Loading subsidiaries...</p></div>;
  }

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view subsidiaries.</p></div>;
  }

  if (subsidiaries.length === 0 && !isLoading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-3xl font-bold">Subsidiaries</h1>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Subsidiary
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Subsidiary</DialogTitle>
                <DialogDescription>
                  Create a new subsidiary for your organization.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleCreateSubsidiary)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., North America Division" {...field} />
                        </FormControl>
                        <FormDescription>
                          The name of the subsidiary
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Code (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., NA-DIV" {...field} />
                        </FormControl>
                        <FormDescription>
                          A short code for the subsidiary
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Brief description..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsDialogOpen(false);
                        form.reset();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createSubsidiaryMutation.isPending}>
                      {createSubsidiaryMutation.isPending ? 'Creating...' : 'Create'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
        <p className="mb-4">No subsidiaries found. Create your first subsidiary using the button above.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-3xl font-bold">Subsidiaries</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Subsidiary
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Subsidiary</DialogTitle>
              <DialogDescription>
                Create a new subsidiary for your organization.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateSubsidiary)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., North America Division" {...field} />
                      </FormControl>
                      <FormDescription>
                        The name of the subsidiary
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., NA-DIV" {...field} />
                      </FormControl>
                      <FormDescription>
                        A short code for the subsidiary
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Brief description..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      form.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createSubsidiaryMutation.isPending}>
                    {createSubsidiaryMutation.isPending ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      
      <Table>
        <TableCaption>A list of your organization's subsidiaries.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Active</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subsidiaries.map((subsidiary) => (
            <TableRow key={subsidiary.id}>
              <TableCell className="font-medium">{subsidiary.name}</TableCell>
              <TableCell>{subsidiary.code || '-'}</TableCell>
              <TableCell>{subsidiary.description || '-'}</TableCell>
              <TableCell className="text-right">
                <Badge variant={subsidiary.isActive ? 'default' : 'secondary'}>
                  {subsidiary.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}