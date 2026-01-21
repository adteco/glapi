'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Eye, Copy, Send, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// Type definitions for data structures
interface EstimateLine {
  id: string;
  itemId: string | null;
  itemName: string | null;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  lineAmount: number | string;
  totalLineAmount: number | string;
  discountPercent?: number | string | null;
  discountAmount?: number | string | null;
  taxAmount?: number | string | null;
}

interface Estimate {
  id: string;
  transactionNumber: string;
  entityId: string;
  projectId: string | null;
  transactionDate: string | Date;
  estimateValidUntil: string | Date | null;
  subtotalAmount: number | string;
  discountAmount: number | string | null;
  taxAmount: number | string | null;
  totalAmount: number | string;
  status: string;
  salesStage: string | null;
  probability: number | string | null;
  memo: string | null;
  customerName: string;
  projectName: string | null;
  lines?: EstimateLine[];
}

// Form schemas
const estimateLineSchema = z.object({
  itemId: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  unitPrice: z.number().min(0, "Unit price must be positive"),
  discountPercent: z.number().min(0).max(100, "Discount must be between 0 and 100").optional(),
});

const estimateFormSchema = z.object({
  entityId: z.string().min(1, "Client is required"),
  projectId: z.string().optional(),
  transactionDate: z.string().min(1, "Estimate date is required"),
  estimateValidUntil: z.string().min(1, "Valid until date is required"),
  memo: z.string().max(1000, "Memo too long").optional(),
  salesStage: z.enum(['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST']),
  probability: z.number().min(0).max(100, "Probability must be between 0 and 100"),
  lines: z.array(estimateLineSchema).min(1, "At least one line item is required"),
});

type EstimateFormValues = z.infer<typeof estimateFormSchema>;

const salesStageOptions = [
  { value: 'LEAD', label: 'Lead' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'PROPOSAL', label: 'Proposal' },
  { value: 'NEGOTIATION', label: 'Negotiation' },
  { value: 'CLOSED_WON', label: 'Closed Won' },
  { value: 'CLOSED_LOST', label: 'Closed Lost' },
];

export default function EstimatesPage() {
  const router = useRouter();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null);
  const { orgId } = useAuth();

  // TRPC queries
  const { data: estimatesData, isLoading, refetch } = trpc.estimates.list.useQuery(
    { page: 1, limit: 50 },
    { enabled: !!orgId }
  );

  const { data: selectedEstimate, isLoading: estimateLoading } = trpc.estimates.get.useQuery(
    { id: selectedEstimateId! },
    { enabled: !!selectedEstimateId && (isViewDialogOpen || isDeleteDialogOpen) }
  );

  // TRPC for customers (clients) list
  const { data: clientsData } = trpc.customers.list.useQuery(
    {},
    { enabled: !!orgId }
  );

  // TRPC for projects list
  const { data: projectsData } = trpc.projects.list.useQuery(
    {},
    { enabled: !!orgId }
  );

  // TRPC for items list
  const { data: itemsData } = trpc.items.list.useQuery(
    {},
    { enabled: !!orgId }
  );

  // Mutations
  const createMutation = trpc.estimates.create.useMutation({
    onSuccess: () => {
      toast.success('Estimate created successfully');
      setIsAddDialogOpen(false);
      form.reset();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create estimate');
    },
  });

  const deleteMutation = trpc.estimates.delete.useMutation({
    onSuccess: () => {
      toast.success('Estimate deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedEstimateId(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete estimate');
    },
  });

  const sendMutation = trpc.estimates.send.useMutation({
    onSuccess: () => {
      toast.success('Estimate sent successfully');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to send estimate');
    },
  });

  const acceptMutation = trpc.estimates.accept.useMutation({
    onSuccess: () => {
      toast.success('Estimate accepted');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to accept estimate');
    },
  });

  const declineMutation = trpc.estimates.decline.useMutation({
    onSuccess: () => {
      toast.success('Estimate declined');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to decline estimate');
    },
  });

  const convertMutation = trpc.estimates.convertToSalesOrder.useMutation({
    onSuccess: (data) => {
      toast.success(`Estimate converted to Sales Order ${data.transactionNumber}`);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to convert estimate');
    },
  });

  const estimates = estimatesData?.data || [];
  const clients = clientsData || [];
  const projects = projectsData?.data || [];
  const items = itemsData || [];

  const form = useForm<EstimateFormValues>({
    resolver: zodResolver(estimateFormSchema),
    defaultValues: {
      entityId: "",
      projectId: "",
      transactionDate: new Date().toISOString().split('T')[0],
      estimateValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      memo: "",
      salesStage: "PROPOSAL",
      probability: 50,
      lines: [
        { itemId: "", description: "", quantity: 1, unitPrice: 0, discountPercent: 0 },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const handleAddEstimate = async (values: EstimateFormValues) => {
    createMutation.mutate({
      entityId: values.entityId,
      projectId: values.projectId || undefined,
      transactionDate: new Date(values.transactionDate),
      estimateValidUntil: new Date(values.estimateValidUntil),
      memo: values.memo,
      salesStage: values.salesStage,
      probability: values.probability,
      lines: values.lines.map(line => ({
        itemId: line.itemId || undefined,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountPercent: line.discountPercent,
      })),
    });
  };

  const handleDeleteEstimate = async () => {
    if (!selectedEstimateId) return;
    deleteMutation.mutate({ id: selectedEstimateId });
  };

  const handleSendEstimate = (id: string) => {
    sendMutation.mutate({ id });
  };

  const handleAcceptEstimate = (id: string) => {
    acceptMutation.mutate({ id });
  };

  const handleDeclineEstimate = (id: string) => {
    declineMutation.mutate({ id });
  };

  const handleConvertToSalesOrder = (id: string) => {
    convertMutation.mutate({ id });
  };

  const getStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'DRAFT': return 'outline';
      case 'SENT': return 'default';
      case 'ACCEPTED': return 'default';
      case 'DECLINED': return 'destructive';
      case 'EXPIRED': return 'secondary';
      case 'CONVERTED': return 'default';
      case 'CANCELLED': return 'destructive';
      default: return 'outline';
    }
  };

  const getStageBadgeVariant = (stage: string | null): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (stage) {
      case 'LEAD': return 'outline';
      case 'QUALIFIED': return 'secondary';
      case 'PROPOSAL': return 'default';
      case 'NEGOTIATION': return 'default';
      case 'CLOSED_WON': return 'default';
      case 'CLOSED_LOST': return 'destructive';
      default: return 'outline';
    }
  };

  const formatCurrency = (amount: string | number | null) => {
    const num = parseFloat(String(amount || 0));
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };

  const formatDate = (dateString: string | Date | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view estimates.</p></div>;
  }

  if (isLoading) {
    return <div className="container mx-auto py-10"><p>Loading estimates...</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Sales Estimates</h1>
        <Button onClick={() => {
          form.reset();
          setIsAddDialogOpen(true);
        }}>
          <Plus className="mr-2 h-4 w-4" />
          New Estimate
        </Button>
      </div>

      <Table>
        <TableCaption>A list of sales estimates.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Estimate #</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Valid Until</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Probability</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {estimates.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                No estimates found. Create your first estimate to get started.
              </TableCell>
            </TableRow>
          ) : (
            estimates.map((estimate: Estimate) => (
              <TableRow key={estimate.id}>
                <TableCell className="font-medium">{estimate.transactionNumber}</TableCell>
                <TableCell>{estimate.customerName || 'Unknown'}</TableCell>
                <TableCell>{formatDate(estimate.transactionDate)}</TableCell>
                <TableCell>{formatDate(estimate.estimateValidUntil)}</TableCell>
                <TableCell className="text-right">{formatCurrency(estimate.totalAmount)}</TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(estimate.status)}>
                    {estimate.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {estimate.salesStage && (
                    <Badge variant={getStageBadgeVariant(estimate.salesStage)}>
                      {estimate.salesStage.replace('_', ' ')}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{estimate.probability ? `${estimate.probability}%` : 'N/A'}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedEstimateId(estimate.id);
                        setIsViewDialogOpen(true);
                      }}
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {estimate.status === 'DRAFT' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSendEstimate(estimate.id)}
                        title="Send to Customer"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                    {['DRAFT', 'SENT'].includes(estimate.status) && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleAcceptEstimate(estimate.id)}
                          title="Mark as Accepted"
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeclineEstimate(estimate.id)}
                          title="Mark as Declined"
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </>
                    )}
                    {['DRAFT', 'SENT', 'ACCEPTED'].includes(estimate.status) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleConvertToSalesOrder(estimate.id)}
                        title="Convert to Sales Order"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                    {estimate.status === 'DRAFT' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedEstimateId(estimate.id);
                          setIsDeleteDialogOpen(true);
                        }}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Add Estimate Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Sales Estimate</DialogTitle>
            <DialogDescription>
              Create a new sales estimate for a client.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddEstimate)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="entityId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients.map((client: { id?: string; companyName: string }) => (
                            <SelectItem key={client.id} value={client.id || ''}>
                              {client.companyName}
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
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select project (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">No Project</SelectItem>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="transactionDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimate Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="estimateValidUntil"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valid Until *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="salesStage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sales Stage</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {salesStageOptions.map((option) => (
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
                  name="probability"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Win Probability (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="memo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Memo</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Additional notes..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Line Items</h3>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => append({ itemId: "", description: "", quantity: 1, unitPrice: 0, discountPercent: 0 })}
                  >
                    Add Line Item
                  </Button>
                </div>

                {fields.map((field, index) => (
                  <div key={field.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Line {index + 1}</span>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.itemId`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Item</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select item" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">Custom Item</SelectItem>
                                {items.map((item: Item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.name}
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
                        name={`lines.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description *</FormLabel>
                            <FormControl>
                              <Input placeholder="Line description..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`lines.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantity *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`lines.${index}.unitPrice`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Unit Price *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`lines.${index}.discountPercent`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Discount %</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Estimate'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Estimate Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Estimate Details</DialogTitle>
            <DialogDescription>
              View estimate {selectedEstimate?.transactionNumber}
            </DialogDescription>
          </DialogHeader>
          {estimateLoading ? (
            <p>Loading...</p>
          ) : selectedEstimate ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Estimate Number</label>
                  <p className="text-sm">{selectedEstimate.transactionNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Client</label>
                  <p className="text-sm">{selectedEstimate.customerName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Project</label>
                  <p className="text-sm">{selectedEstimate.projectName || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <p className="text-sm">
                    <Badge variant={getStatusBadgeVariant(selectedEstimate.status)}>
                      {selectedEstimate.status}
                    </Badge>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Date</label>
                  <p className="text-sm">{formatDate(selectedEstimate.transactionDate)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Valid Until</label>
                  <p className="text-sm">{formatDate(selectedEstimate.estimateValidUntil)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Sales Stage</label>
                  <p className="text-sm">{selectedEstimate.salesStage?.replace('_', ' ') || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Win Probability</label>
                  <p className="text-sm">{selectedEstimate.probability ? `${selectedEstimate.probability}%` : 'N/A'}</p>
                </div>
              </div>
              {selectedEstimate.memo && (
                <div>
                  <label className="text-sm font-medium">Memo</label>
                  <p className="text-sm">{selectedEstimate.memo}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium">Line Items</label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedEstimate.lines?.map((line: EstimateLine) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.itemName || 'Custom'}</TableCell>
                        <TableCell>{line.description}</TableCell>
                        <TableCell className="text-right">{line.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(line.unitPrice)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(line.totalLineAmount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(selectedEstimate.subtotalAmount)}</span>
                  </div>
                  {parseFloat(String(selectedEstimate.discountAmount || 0)) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Discount:</span>
                      <span>-{formatCurrency(selectedEstimate.discountAmount)}</span>
                    </div>
                  )}
                  {parseFloat(String(selectedEstimate.taxAmount || 0)) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Tax:</span>
                      <span>{formatCurrency(selectedEstimate.taxAmount)}</span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-lg font-semibold">Total: </span>
                  <span className="text-lg font-bold">{formatCurrency(selectedEstimate.totalAmount)}</span>
                </div>
              </div>
            </div>
          ) : (
            <p>Estimate not found</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Estimate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete estimate {selectedEstimate?.transactionNumber}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEstimate}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
