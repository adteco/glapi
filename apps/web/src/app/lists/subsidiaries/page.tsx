'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { useApiClient } from '@/lib/api-client.client';
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
import * as z from "zod";

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

// Form schema
const subsidiaryFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  code: z.string().max(50).optional().or(z.literal('')),
  description: z.string().max(1000).optional().or(z.literal('')),
});

type SubsidiaryFormValues = z.infer<typeof subsidiaryFormSchema>;

export default function SubsidiariesPage() {
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { getToken, orgId } = useAuth();
  const { apiGet, apiPost } = useApiClient();
  const previousOrgIdRef = useRef<string | null>(null);

  const form = useForm<SubsidiaryFormValues>({
    // resolver: zodResolver(subsidiaryFormSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
    },
  });

  // Create default subsidiary
  const createDefaultSubsidiary = useCallback(async () => {
    try {
      const newSubsidiary = await apiPost<Subsidiary>('/api/subsidiaries', {
        name: 'Default Subsidiary',
        code: 'DEFAULT',
        description: 'Default subsidiary for the organization',
      });
      
      setSubsidiaries([newSubsidiary]);
      toast.success('Default subsidiary created automatically.');
    } catch (error) {
      console.error('Error creating default subsidiary:', error);
    }
  }, [apiPost]);

  // Fetch subsidiaries
  const fetchSubsidiaries = useCallback(async () => {
    if (!orgId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await apiGet<{ data: Subsidiary[] }>('/api/subsidiaries');
      setSubsidiaries(data.data || []);
      
      // Create default subsidiary if none exist
      if (!data.data || data.data.length === 0) {
        await createDefaultSubsidiary();
      }
    } catch (error) {
      console.error('Error fetching subsidiaries:', error);
      toast.error('Failed to fetch subsidiaries.');
    } finally {
      setIsLoading(false);
    }
  }, [orgId, apiGet, createDefaultSubsidiary]);

  // Clear data and refetch when organization changes
  useEffect(() => {
    if (orgId && orgId !== previousOrgIdRef.current) {
      // Clear existing data immediately when org changes
      setSubsidiaries([]);
      previousOrgIdRef.current = orgId;
    }
    fetchSubsidiaries();
  }, [orgId, fetchSubsidiaries]);

  // Submit form
  const onSubmit = async (values: SubsidiaryFormValues) => {
    if (!orgId) {
      toast.error('Organization not selected.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiPost('/api/subsidiaries', {
        name: values.name,
        code: values.code || undefined,
        description: values.description || undefined,
      });
      
      toast.success('Subsidiary created successfully!');
      setIsDialogOpen(false);
      form.reset();
      
      // Refresh the subsidiaries list
      await fetchSubsidiaries();
    } catch (error) {
      console.error('Error creating subsidiary:', error);
      toast.error('Failed to create subsidiary.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="container mx-auto py-10"><p>Loading subsidiaries...</p></div>;
  }

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view subsidiaries.</p></div>;
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
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      
      {subsidiaries.length === 0 && !isLoading ? (
        <div>
          <p className="mb-4">No subsidiaries found. Create your first subsidiary using the button above.</p>
        </div>
      ) : (
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
      )}
    </div>
  );
}