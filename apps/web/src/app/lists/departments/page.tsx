'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
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
interface Department {
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
const departmentFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  code: z.string().max(50).optional().or(z.literal('')),
  description: z.string().max(1000).optional().or(z.literal('')),
  subsidiaryId: z.string().min(1, "Subsidiary is required"),
});

type DepartmentFormValues = z.infer<typeof departmentFormSchema>;

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { getToken, orgId } = useAuth();

  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      subsidiaryId: "",
    },
  });

  // Fetch departments
  useEffect(() => {
    const fetchDepartments = async () => {
      if (!orgId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const token = await getToken();
        if (!token) {
          toast.error('Authentication token not available.');
          setIsLoading(false);
          return;
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/v1/departments`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorResult = await response.json();
          toast.error(errorResult.message || errorResult.error || 'Failed to fetch departments.');
          throw new Error('Failed to fetch departments');
        }

        const data = await response.json();
        setDepartments(data.data || []);
      } catch (error) {
        console.error('Error fetching departments:', error);
        if (!(error instanceof Error && error.message === 'Failed to fetch departments')) {
          toast.error('An unexpected error occurred while fetching departments.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchDepartments();
  }, [orgId, getToken]);

  // Fetch subsidiaries
  useEffect(() => {
    const fetchSubsidiaries = async () => {
      if (!orgId) return;
      
      try {
        const token = await getToken();
        if (!token) return;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/v1/subsidiaries`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.error('Failed to fetch subsidiaries');
          return;
        }

        const data = await response.json();
        setSubsidiaries(data.data || []);
      } catch (error) {
        console.error('Error fetching subsidiaries:', error);
      }
    };

    fetchSubsidiaries();
  }, [orgId, getToken]);

  // Handle form submission
  const onSubmit = async (values: DepartmentFormValues) => {
    if (!orgId) {
      toast.error('Organization not selected.');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Authentication token not available.');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/v1/departments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: values.name,
          code: values.code || undefined,
          description: values.description || undefined,
          subsidiaryId: values.subsidiaryId,
        }),
      });

      if (!response.ok) {
        const errorResult = await response.json();
        toast.error(errorResult.message || 'Failed to create department.');
        throw new Error('Failed to create department');
      }

      const result = await response.json();
      
      toast.success('Department created successfully!');
      setIsDialogOpen(false);
      form.reset();
      
      // Refresh the departments list
      const refreshResponse = await fetch(`${apiUrl}/api/v1/departments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        setDepartments(data.data || []);
      }
    } catch (error) {
      console.error('Error creating department:', error);
      if (!(error instanceof Error && error.message === 'Failed to create department')) {
        toast.error('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Departments</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Department
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Create New Department</DialogTitle>
              <DialogDescription>
                Add a new department to your organization. Departments help categorize transactions.
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
                        <Input placeholder="Engineering" {...field} />
                      </FormControl>
                      <FormDescription>
                        The name of the department.
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
                        <Input placeholder="ENG" {...field} />
                      </FormControl>
                      <FormDescription>
                        A short code to identify the department.
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
                        <Input placeholder="Engineering and product development" {...field} />
                      </FormControl>
                      <FormDescription>
                        A brief description of the department.
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        The subsidiary this department belongs to.
                      </FormDescription>
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
                    {isSubmitting ? 'Creating...' : 'Create Department'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-10">Loading departments...</div>
      ) : departments.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-muted-foreground mb-4">No departments found. Create your first department to get started.</p>
        </div>
      ) : (
        <Table>
          <TableCaption>A list of all departments in your organization.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Subsidiary</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.map((department) => (
              <TableRow key={department.id}>
                <TableCell className="font-medium">{department.name}</TableCell>
                <TableCell>{department.code || '-'}</TableCell>
                <TableCell>{department.description || '-'}</TableCell>
                <TableCell>{department.subsidiary?.name || '-'}</TableCell>
                <TableCell>
                  <Badge variant={department.isActive ? 'default' : 'secondary'}>
                    {department.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(department.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}