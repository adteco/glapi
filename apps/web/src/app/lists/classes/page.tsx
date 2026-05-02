'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Edit, Plus, Trash2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Define interfaces
interface Class {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  organizationId: string;
  subsidiaryId: string;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  subsidiary?: {
    id: string;
    name: string;
  };
}

const classFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

type ClassFormValues = z.infer<typeof classFormSchema>;

export default function ClassesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
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
      setSelectedClass(null);
      form.reset();
      refetchClasses();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create class');
    },
  });

  const updateClassMutation = trpc.classes.update.useMutation({
    onSuccess: () => {
      toast.success('Class updated successfully!');
      setIsDialogOpen(false);
      setSelectedClass(null);
      form.reset();
      refetchClasses();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update class');
    },
  });

  const deleteClassMutation = trpc.classes.delete.useMutation({
    onSuccess: () => {
      toast.success('Class deleted successfully!');
      setIsDeleteDialogOpen(false);
      setSelectedClass(null);
      refetchClasses();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete class');
    },
  });

  const form = useForm<ClassFormValues>({
    resolver: zodResolver(classFormSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      isActive: true,
    },
  });


  // Submit form
  const onSubmit = async (values: ClassFormValues) => {
    if (!orgId) {
      toast.error('Organization not selected.');
      return;
    }

    const data = {
      name: values.name,
      code: values.code && values.code.trim() ? values.code.trim() : undefined,
      description: values.description && values.description.trim() ? values.description.trim() : undefined,
      isActive: values.isActive,
    };

    if (selectedClass) {
      updateClassMutation.mutate({
        id: selectedClass.id,
        data,
      });
      return;
    }

    createClassMutation.mutate(data);
  };

  const openCreateDialog = () => {
    setSelectedClass(null);
    form.reset({
      name: "",
      code: "",
      description: "",
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (classItem: Class) => {
    setSelectedClass(classItem);
    form.reset({
      name: classItem.name,
      code: classItem.code || "",
      description: classItem.description || "",
      isActive: classItem.isActive,
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (classItem: Class) => {
    setSelectedClass(classItem);
    setIsDeleteDialogOpen(true);
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
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Class
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{selectedClass ? 'Edit Class' : 'Add New Class'}</DialogTitle>
              <DialogDescription>
                {selectedClass
                  ? 'Update this class for categorizing transactions.'
                  : 'Create a new class for categorizing transactions.'}
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
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Optional description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">Active</FormLabel>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      setSelectedClass(null);
                      form.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createClassMutation.isPending || updateClassMutation.isPending}>
                    {createClassMutation.isPending || updateClassMutation.isPending
                      ? 'Saving...'
                      : selectedClass ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
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
              <TableHead className="text-right">Actions</TableHead>
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
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(classItem)}
                      title="Edit class"
                    >
                      <Edit className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeleteDialog(classItem)}
                      title="Delete class"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Class</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete {selectedClass?.name ? `"${selectedClass.name}"` : 'this class'}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedClass(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedClass && deleteClassMutation.mutate({ id: selectedClass.id })}
              disabled={deleteClassMutation.isPending}
            >
              {deleteClassMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
