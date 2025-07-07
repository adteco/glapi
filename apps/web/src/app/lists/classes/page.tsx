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
});

type ClassFormValues = z.infer<typeof classFormSchema>;

export default function ClassesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { orgId } = useAuth();
  
  // TRPC queries
  const { data: classes = [], isLoading: classesLoading, refetch: refetchClasses } = trpc.classes.list.useQuery({}, {
    enabled: !!orgId,
  });
  
  
  // TRPC mutations
  const createClassMutation = trpc.classes.create.useMutation({
    onSuccess: () => {
      toast.success('Class created successfully!');
      setIsDialogOpen(false);
      form.reset();
      refetchClasses();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create class');
    },
  });

  const form = useForm<ClassFormValues>({
    // resolver: zodResolver(classFormSchema),
    defaultValues: {
      name: "",
      code: "",
    },
  });


  // Submit form
  const onSubmit = async (values: ClassFormValues) => {
    if (!orgId) {
      toast.error('Organization not selected.');
      return;
    }

    createClassMutation.mutate({
      name: values.name,
      code: values.code || undefined,
      isActive: true,
    });
  };

  if (classesLoading) {
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
                  <Button type="submit" disabled={createClassMutation.isPending}>
                    {createClassMutation.isPending ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      
      {classes.length === 0 && !classesLoading ? (
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
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.map((classItem) => (
              <TableRow key={classItem.id}>
                <TableCell className="font-medium">{classItem.name}</TableCell>
                <TableCell>{classItem.code || '-'}</TableCell>
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