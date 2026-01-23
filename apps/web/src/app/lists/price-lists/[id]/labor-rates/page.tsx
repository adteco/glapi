'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash, Edit, DollarSign, Users, Briefcase } from 'lucide-react';
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
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { RouterOutputs } from '@glapi/trpc';

// Use TRPC inferred types
type LaborRate = RouterOutputs['priceLists']['getLaborRates']['data'][number];
type PriceList = RouterOutputs['priceLists']['getById'];

// Form schema
const laborRateFormSchema = z.object({
  employeeId: z.string().optional(),
  laborRole: z.string().optional(),
  projectId: z.string().optional(),
  costCodeId: z.string().optional(),
  laborRate: z.string().min(1, "Labor rate is required").refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
    message: "Labor rate must be a valid positive number",
  }),
  burdenRate: z.string().refine((val) => val === '' || (!isNaN(Number(val)) && Number(val) >= 0), {
    message: "Burden rate must be a valid positive number",
  }).default('0'),
  billingRate: z.string().min(1, "Billing rate is required").refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
    message: "Billing rate must be a valid positive number",
  }),
  overtimeMultiplier: z.string().refine((val) => val === '' || (!isNaN(Number(val)) && Number(val) > 0), {
    message: "Overtime multiplier must be a positive number",
  }).default('1.5'),
  doubleTimeMultiplier: z.string().refine((val) => val === '' || (!isNaN(Number(val)) && Number(val) > 0), {
    message: "Double time multiplier must be a positive number",
  }).default('2.0'),
  priority: z.string().refine((val) => val === '' || (!isNaN(Number(val)) && Number(val) >= 0), {
    message: "Priority must be a non-negative number",
  }).default('0'),
  effectiveDate: z.string().min(1, "Effective date is required"),
  expirationDate: z.string().optional(),
  description: z.string().optional(),
});

type LaborRateFormValues = z.infer<typeof laborRateFormSchema>;

export default function LaborRatesPage() {
  const params = useParams();
  const router = useRouter();
  const priceListId = params.id as string;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<LaborRate | null>(null);
  const { orgId } = useAuth();
  const previousOrgIdRef = useRef<string | null>(null);

  // tRPC queries
  const { data: priceList, isLoading: isLoadingPriceList } = trpc.priceLists.getById.useQuery(
    { id: priceListId },
    { enabled: !!orgId && !!priceListId }
  );

  const { data: laborRatesData, isLoading: isLoadingRates, refetch: refetchRates } = trpc.priceLists.getLaborRates.useQuery(
    { priceListId, limit: 100 },
    { enabled: !!orgId && !!priceListId }
  );

  const { data: employeesData } = trpc.entities.list.useQuery(
    { entityTypes: ['Employee'], limit: 500 },
    { enabled: !!orgId }
  );

  const { data: projectsData } = trpc.projects.list.useQuery(
    { limit: 500 },
    { enabled: !!orgId }
  );

  const laborRates = laborRatesData?.data || [];
  const employees = employeesData?.data || [];
  const projects = projectsData?.data || [];

  // Mutations
  const createMutation = trpc.priceLists.createLaborRate.useMutation({
    onSuccess: () => {
      toast.success('Labor rate created successfully!');
      setIsDialogOpen(false);
      form.reset();
      refetchRates();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create labor rate');
    },
  });

  const updateMutation = trpc.priceLists.updateLaborRate.useMutation({
    onSuccess: () => {
      toast.success('Labor rate updated successfully!');
      setIsEditDialogOpen(false);
      setEditingRate(null);
      editForm.reset();
      refetchRates();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update labor rate');
    },
  });

  const deleteMutation = trpc.priceLists.deleteLaborRate.useMutation({
    onSuccess: () => {
      toast.success('Labor rate deleted successfully!');
      refetchRates();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete labor rate');
    },
  });

  const form = useForm<LaborRateFormValues>({
    resolver: zodResolver(laborRateFormSchema),
    defaultValues: {
      employeeId: "",
      laborRole: "",
      projectId: "",
      costCodeId: "",
      laborRate: "",
      burdenRate: "0",
      billingRate: "",
      overtimeMultiplier: "1.5",
      doubleTimeMultiplier: "2.0",
      priority: "0",
      effectiveDate: new Date().toISOString().split('T')[0],
      expirationDate: "",
      description: "",
    },
  });

  const editForm = useForm<LaborRateFormValues>({
    resolver: zodResolver(laborRateFormSchema),
    defaultValues: {
      employeeId: "",
      laborRole: "",
      projectId: "",
      costCodeId: "",
      laborRate: "",
      burdenRate: "0",
      billingRate: "",
      overtimeMultiplier: "1.5",
      doubleTimeMultiplier: "2.0",
      priority: "0",
      effectiveDate: new Date().toISOString().split('T')[0],
      expirationDate: "",
      description: "",
    },
  });

  // Clear state when organization changes
  useEffect(() => {
    if (orgId && orgId !== previousOrgIdRef.current) {
      previousOrgIdRef.current = orgId;
      form.reset();
      editForm.reset();
    }
  }, [orgId, form, editForm]);

  // Handle form submission for create
  const onSubmit = async (values: LaborRateFormValues) => {
    if (!orgId || !priceListId) {
      toast.error('Missing required information.');
      return;
    }

    createMutation.mutate({
      priceListId,
      employeeId: values.employeeId || null,
      laborRole: values.laborRole || null,
      projectId: values.projectId || null,
      costCodeId: values.costCodeId || null,
      laborRate: parseFloat(values.laborRate),
      burdenRate: parseFloat(values.burdenRate || '0'),
      billingRate: parseFloat(values.billingRate),
      overtimeMultiplier: parseFloat(values.overtimeMultiplier || '1.5'),
      doubleTimeMultiplier: parseFloat(values.doubleTimeMultiplier || '2.0'),
      priority: parseInt(values.priority || '0', 10),
      effectiveDate: new Date(values.effectiveDate),
      expirationDate: values.expirationDate ? new Date(values.expirationDate) : null,
      description: values.description || null,
    });
  };

  // Handle form submission for edit
  const onEditSubmit = async (values: LaborRateFormValues) => {
    if (!orgId || !editingRate) {
      toast.error('Missing required information.');
      return;
    }

    updateMutation.mutate({
      id: editingRate.id,
      data: {
        employeeId: values.employeeId || null,
        laborRole: values.laborRole || null,
        projectId: values.projectId || null,
        costCodeId: values.costCodeId || null,
        laborRate: parseFloat(values.laborRate),
        burdenRate: parseFloat(values.burdenRate || '0'),
        billingRate: parseFloat(values.billingRate),
        overtimeMultiplier: parseFloat(values.overtimeMultiplier || '1.5'),
        doubleTimeMultiplier: parseFloat(values.doubleTimeMultiplier || '2.0'),
        priority: parseInt(values.priority || '0', 10),
        effectiveDate: new Date(values.effectiveDate),
        expirationDate: values.expirationDate ? new Date(values.expirationDate) : null,
        description: values.description || null,
      },
    });
  };

  // Handle delete
  const handleDelete = async (rate: LaborRate) => {
    if (!confirm('Are you sure you want to delete this labor rate?')) {
      return;
    }
    deleteMutation.mutate({ id: rate.id });
  };

  // Open edit dialog
  const openEditDialog = (rate: LaborRate) => {
    setEditingRate(rate);
    editForm.reset({
      employeeId: rate.employeeId || "",
      laborRole: rate.laborRole || "",
      projectId: rate.projectId || "",
      costCodeId: rate.costCodeId || "",
      laborRate: rate.laborRate.toString(),
      burdenRate: rate.burdenRate.toString(),
      billingRate: rate.billingRate.toString(),
      overtimeMultiplier: rate.overtimeMultiplier.toString(),
      doubleTimeMultiplier: rate.doubleTimeMultiplier.toString(),
      priority: rate.priority.toString(),
      effectiveDate: rate.effectiveDate,
      expirationDate: rate.expirationDate || "",
      description: rate.description || "",
    });
    setIsEditDialogOpen(true);
  };

  // Format rate target display
  const formatRateTarget = (rate: LaborRate) => {
    const parts: string[] = [];
    if (rate.employee?.displayName) {
      parts.push(rate.employee.displayName);
    }
    if (rate.laborRole) {
      parts.push(rate.laborRole);
    }
    if (rate.project?.name) {
      parts.push(rate.project.name);
    }
    if (rate.costCode?.name) {
      parts.push(rate.costCode.name);
    }
    return parts.length > 0 ? parts.join(' / ') : 'Default Rate';
  };

  // Check if rate is active
  const isRateActive = (rate: LaborRate) => {
    const today = new Date().toISOString().split('T')[0];
    const isEffective = rate.effectiveDate <= today;
    const notExpired = !rate.expirationDate || rate.expirationDate >= today;
    return isEffective && notExpired;
  };

  const isLoading = isLoadingPriceList || isLoadingRates;

  // Render form fields (shared between create and edit)
  const renderFormFields = (formInstance: typeof form | typeof editForm, isEdit = false) => (
    <>
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={formInstance.control}
          name="employeeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Employee (Optional)</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="">None (use role-based)</SelectItem>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Specific employee for this rate
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={formInstance.control}
          name="laborRole"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Labor Role (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Senior Developer" {...field} />
              </FormControl>
              <FormDescription>
                Role-based rate (e.g., &quot;Project Manager&quot;)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={formInstance.control}
          name="projectId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project (Optional)</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="">All Projects</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.projectCode} - {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Project-specific rate
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={formInstance.control}
          name="costCodeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cost Code (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="Cost code ID" {...field} />
              </FormControl>
              <FormDescription>
                Cost code-specific rate
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <FormField
          control={formInstance.control}
          name="laborRate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Labor Rate *</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Internal cost rate
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={formInstance.control}
          name="burdenRate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Burden Rate</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Overhead cost
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={formInstance.control}
          name="billingRate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Billing Rate *</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Customer rate
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <FormField
          control={formInstance.control}
          name="overtimeMultiplier"
          render={({ field }) => (
            <FormItem>
              <FormLabel>OT Multiplier</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="1.5"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={formInstance.control}
          name="doubleTimeMultiplier"
          render={({ field }) => (
            <FormItem>
              <FormLabel>DT Multiplier</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="2.0"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={formInstance.control}
          name="priority"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Priority</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="1"
                  placeholder="0"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Higher wins
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={formInstance.control}
          name="effectiveDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Effective Date *</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={formInstance.control}
          name="expirationDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Expiration Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={formInstance.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea placeholder="Optional description..." {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => router.push('/lists/price-lists')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Price Lists
        </Button>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Users className="h-8 w-8" />
            <div>
              <h1 className="text-3xl font-bold">Labor Rates</h1>
              {priceList && (
                <p className="text-muted-foreground">
                  {priceList.name} ({priceList.code}) - {priceList.currencyCode}
                </p>
              )}
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Labor Rate
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Labor Rate</DialogTitle>
                <DialogDescription>
                  Set labor/billing rates for this price list. More specific targeting (employee + project) takes precedence over general rates.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {renderFormFields(form)}
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
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? 'Creating...' : 'Create Labor Rate'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Labor Rate</DialogTitle>
            <DialogDescription>
              Update labor rate information.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              {renderFormFields(editForm, true)}
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingRate(null);
                    editForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Updating...' : 'Update Labor Rate'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="text-center py-10">Loading labor rates...</div>
      ) : laborRates.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-muted-foreground mb-4">
            No labor rates in this price list yet. Add rates to define billing rates for employees, roles, or projects.
          </p>
        </div>
      ) : (
        <Table>
          <TableCaption>Labor rates for billing calculations.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Target</TableHead>
              <TableHead>Labor Rate</TableHead>
              <TableHead>Burden Rate</TableHead>
              <TableHead>Billing Rate</TableHead>
              <TableHead>OT / DT</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Effective</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {laborRates.map((rate) => (
              <TableRow key={rate.id}>
                <TableCell className="font-medium max-w-xs">
                  <div className="truncate" title={formatRateTarget(rate)}>
                    {formatRateTarget(rate)}
                  </div>
                  {rate.description && (
                    <div className="text-xs text-muted-foreground truncate" title={rate.description}>
                      {rate.description}
                    </div>
                  )}
                </TableCell>
                <TableCell>{priceList?.currencyCode} {rate.laborRate.toFixed(2)}</TableCell>
                <TableCell>{priceList?.currencyCode} {rate.burdenRate.toFixed(2)}</TableCell>
                <TableCell className="font-semibold">{priceList?.currencyCode} {rate.billingRate.toFixed(2)}</TableCell>
                <TableCell>{rate.overtimeMultiplier}x / {rate.doubleTimeMultiplier}x</TableCell>
                <TableCell>{rate.priority}</TableCell>
                <TableCell>
                  {new Date(rate.effectiveDate).toLocaleDateString()}
                  {rate.expirationDate && (
                    <span className="text-muted-foreground">
                      {' → '}{new Date(rate.expirationDate).toLocaleDateString()}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={isRateActive(rate) ? 'default' : 'secondary'}>
                    {isRateActive(rate) ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(rate)}
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(rate)}
                      title="Delete"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
