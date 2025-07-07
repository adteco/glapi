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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// Define interfaces
interface Class {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  organizationId: string;
  subsidiaryId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  subsidiary?: {
    id: string;
    name: string;
  };
}

interface Subsidiary {
  id: string;
  name: string;
  code?: string;
}

// Form schema
const classFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  code: z.string().max(50).optional().or(z.literal('')),
  description: z.string().max(1000).optional().or(z.literal('')),
  subsidiaryId: z.string().min(1, "Subsidiary is required"),
});

type ClassFormValues = z.infer<typeof classFormSchema>;

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { getToken, orgId } = useAuth();
  const { apiGet, apiPost } = useApiClient();
  const previousOrgIdRef = useRef<string | null>(null);

  const form = useForm<ClassFormValues>({
    // resolver: zodResolver(classFormSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      subsidiaryId: "",
    },
  });

  // Fetch classes
  const fetchClasses = useCallback(async () => {
    if (!orgId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await apiGet<{ data: Class[] }>('/api/classes');
      setClasses(data.data || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
      toast.error('Failed to fetch classes.');
    } finally {
      setIsLoading(false);
    }
  }, [orgId, apiGet]);

  // Create default class
  const createDefaultClass = useCallback(async (subsidiaryId: string) => {
    try {
      const newClass = await apiPost<Class>('/api/classes', {
        name: 'Default Class',
        code: 'DEFAULT',
        description: 'Default class for transactions',
        subsidiaryId: subsidiaryId,
      });
      setClasses([newClass]);
    } catch (error) {
      console.error('Error creating default class:', error);
    }
  }, [apiPost]);

  // Create default subsidiary
  const createDefaultSubsidiary = useCallback(async () => {
    try {
      const newSubsidiary = await apiPost<Subsidiary>('/api/subsidiaries', {
        name: 'Default Subsidiary',
        code: 'DEFAULT',
        description: 'Default subsidiary for the organization',
      });
      setSubsidiaries([newSubsidiary]);
      
      // Create default class
      await createDefaultClass(newSubsidiary.id);
    } catch (error) {
      console.error('Error creating default subsidiary:', error);
    }
  }, [apiPost, createDefaultClass]);

  // Fetch subsidiaries
  const fetchSubsidiaries = useCallback(async () => {
    if (!orgId) return;
    
    try {
      const data = await apiGet<{ data: Subsidiary[] }>('/api/subsidiaries');
      const subs = data.data || [];
      setSubsidiaries(subs);
      
      // Create default subsidiary if none exist
      if (subs.length === 0) {
        await createDefaultSubsidiary();
      }
    } catch (error) {
      console.error('Error fetching subsidiaries:', error);
    }
  }, [orgId, apiGet, createDefaultSubsidiary]);

  // Clear data and refetch when organization changes
  useEffect(() => {
    if (orgId && orgId !== previousOrgIdRef.current) {
      // Clear existing data immediately when org changes
      setClasses([]);
      setSubsidiaries([]);
      previousOrgIdRef.current = orgId;
    }
    fetchClasses();
  }, [orgId, fetchClasses]);

  useEffect(() => {
    fetchSubsidiaries();
  }, [fetchSubsidiaries]);

  // Submit form
  const onSubmit = async (values: ClassFormValues) => {
    if (!orgId) {
      toast.error('Organization not selected.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiPost<{ data: Class }>('/api/classes', {
        ...values,
        code: values.code || undefined,
        description: values.description || undefined,
      });
      setClasses([...classes, response.data]);
      toast.success('Class created successfully!');
      setIsDialogOpen(false);
      form.reset();
    } catch (error) {
      console.error('Error creating class:', error);
      toast.error('Failed to create class.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="container mx-auto py-10"><p>Loading classes...</p></div>;
  }

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view classes.</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-3xl font-bold">Classes</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Class
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Class</DialogTitle>
              <DialogDescription>
                Create a new class for categorizing transactions.
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
                        <Input placeholder="e.g., Marketing" {...field} />
                      </FormControl>
                      <FormDescription>
                        The name of the class
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
                        <Input placeholder="e.g., MKT" {...field} />
                      </FormControl>
                      <FormDescription>
                        A short code for the class
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="subsidiaryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subsidiary</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a subsidiary" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {subsidiaries.map((subsidiary) => (
                            <SelectItem key={subsidiary.id} value={subsidiary.id}>
                              {subsidiary.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Select the subsidiary for this class
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
      
      {classes.length === 0 && !isLoading ? (
        <div>
          <p className="mb-4">No classes found. Create your first class using the button above.</p>
        </div>
      ) : (
        <Table>
          <TableCaption>A list of your organization's classes.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Subsidiary</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.map((classItem) => (
              <TableRow key={classItem.id}>
                <TableCell className="font-medium">{classItem.name}</TableCell>
                <TableCell>{classItem.code || '-'}</TableCell>
                <TableCell>{classItem.subsidiary?.name || 'N/A'}</TableCell>
                <TableCell>{classItem.description || '-'}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={classItem.isActive ? 'default' : 'secondary'}>
                    {classItem.isActive ? 'Active' : 'Inactive'}
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