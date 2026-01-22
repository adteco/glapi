'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Edit2, Trash2, Ruler } from 'lucide-react';
import { SeedUnitsOfMeasureButton } from '@/components/SeedUnitsOfMeasureButton';
import type { RouterOutputs } from '@glapi/trpc';

const unitFormSchema = z.object({
  code: z.string().min(1, 'Code is required').max(10),
  name: z.string().min(1, 'Name is required').max(100),
  abbreviation: z.string().min(1, 'Abbreviation is required').max(10),
  baseConversionFactor: z.number().positive().default(1),
  decimalPlaces: z.number().int().min(0).max(6).default(2),
  isActive: z.boolean().default(true),
});

type UnitFormValues = z.infer<typeof unitFormSchema>;

// Use TRPC inferred types to prevent type drift
type UnitOfMeasure = RouterOutputs['unitsOfMeasure']['list']['data'][number];

// Local interface kept for backwards compatibility
interface _UnitOfMeasureLocal {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function UnitsOfMeasurePage() {
  const { orgId } = useAuth();
  const previousOrgIdRef = useRef<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<UnitOfMeasure | null>(null);
  const [deleteUnit, setDeleteUnit] = useState<UnitOfMeasure | null>(null);

  // tRPC queries and mutations
  const { data: unitsData, isLoading, refetch } = trpc.unitsOfMeasure.list.useQuery({
    page: 1,
    limit: 100,
  }, {
    enabled: !!orgId,
  });

  const createUnitMutation = trpc.unitsOfMeasure.create.useMutation({
    onSuccess: () => {
      toast.success('Unit of measure created successfully');
      setIsAddDialogOpen(false);
      form.reset();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create unit of measure');
    },
  });

  const updateUnitMutation = trpc.unitsOfMeasure.update.useMutation({
    onSuccess: () => {
      toast.success('Unit of measure updated successfully');
      setIsEditDialogOpen(false);
      setSelectedUnit(null);
      form.reset();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update unit of measure');
    },
  });

  const deleteUnitMutation = trpc.unitsOfMeasure.delete.useMutation({
    onSuccess: () => {
      toast.success('Unit of measure deleted successfully');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete unit of measure');
    },
  });

  const units = unitsData?.data || [];

  const form = useForm<UnitFormValues>({
    resolver: zodResolver(unitFormSchema),
    defaultValues: {
      code: '',
      name: '',
      abbreviation: '',
      baseConversionFactor: 1,
      decimalPlaces: 2,
      isActive: true,
    },
  });

  // Clear state when organization changes
  useEffect(() => {
    if (orgId && orgId !== previousOrgIdRef.current) {
      previousOrgIdRef.current = orgId;
      // Reset form when org changes
      form.reset();
    }
  }, [orgId, form]);

  const handleAddUnit = async (values: UnitFormValues) => {
    if (!orgId) {
      toast.error('Organization not selected.');
      return;
    }

    createUnitMutation.mutate(values);
  };

  const handleEditUnit = async (values: UnitFormValues) => {
    if (!orgId || !selectedUnit) {
      toast.error('Organization not selected.');
      return;
    }
    
    updateUnitMutation.mutate({
      id: selectedUnit.id,
      data: values,
    });
  };

  const handleDeleteUnit = async (unit: UnitOfMeasure) => {
    if (!orgId) {
      toast.error('Organization not selected.');
      return;
    }

    deleteUnitMutation.mutate({ id: unit.id });
  };

  const openEditDialog = (unit: UnitOfMeasure) => {
    setSelectedUnit(unit);
    form.reset({
      code: unit.code,
      name: unit.name,
      abbreviation: unit.abbreviation,
      baseConversionFactor: unit.baseConversionFactor,
      decimalPlaces: unit.decimalPlaces,
      isActive: unit.isActive,
    });
    setIsEditDialogOpen(true);
  };

  if (isLoading) {
    return <div className="container mx-auto py-10"><p>Loading units of measure...</p></div>;
  }

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view units of measure.</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Units of Measure</h1>
        <div className="flex gap-2">
          <SeedUnitsOfMeasureButton />
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Unit
          </Button>
        </div>
      </div>

      {units.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-500 mb-4">No units of measure found. Create your first unit to get started.</p>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Unit
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          {units.map((unit) => (
            <div
              key={unit.id}
              className={`flex items-center justify-between py-3 px-4 hover:bg-gray-100/50 rounded-md transition-colors border-b border-gray-100 ${
                !unit.isActive ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <Ruler className="h-4 w-4 text-gray-500" />
                <div>
                  <span className="font-medium">{unit.name}</span>
                  <span className="text-sm text-gray-500 ml-2">{unit.code} - {unit.abbreviation}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEditDialog(unit)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteUnit(unit)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Unit Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Unit of Measure</DialogTitle>
            <DialogDescription>
              Create a new unit of measure for your items.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddUnit)} className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input placeholder="KG" {...field} />
                    </FormControl>
                    <FormDescription>
                      Unique code for the unit (max 10 characters)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Kilogram" {...field} />
                    </FormControl>
                    <FormDescription>
                      The full name of the unit
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="abbreviation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Abbreviation</FormLabel>
                    <FormControl>
                      <Input placeholder="kg" {...field} />
                    </FormControl>
                    <FormDescription>
                      Short form of the unit (max 10 characters)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="baseConversionFactor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conversion Factor</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.000001" 
                          placeholder="1" 
                          {...field}
                          onChange={e => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Factor to convert to base unit
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="decimalPlaces"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Decimal Places</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0" 
                          max="6" 
                          placeholder="2" 
                          {...field}
                          onChange={e => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Precision (0-6)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Whether this unit is available for use
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createUnitMutation.isPending}>
                  {createUnitMutation.isPending ? 'Creating...' : 'Create Unit'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Unit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Unit of Measure</DialogTitle>
            <DialogDescription>
              Update the unit of measure details.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEditUnit)} className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="abbreviation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Abbreviation</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="baseConversionFactor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conversion Factor</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.000001" 
                          {...field}
                          onChange={e => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="decimalPlaces"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Decimal Places</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0" 
                          max="6" 
                          {...field}
                          onChange={e => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Whether this unit is available for use
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setSelectedUnit(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateUnitMutation.isPending}>
                  {updateUnitMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteUnit} onOpenChange={() => setDeleteUnit(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the unit
              "{deleteUnit?.name}" and may affect items using this unit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteUnit) {
                  handleDeleteUnit(deleteUnit);
                  setDeleteUnit(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}