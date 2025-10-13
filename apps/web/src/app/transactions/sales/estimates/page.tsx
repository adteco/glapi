'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Eye, Copy } from 'lucide-react';
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

// Define interfaces for the Estimate data
interface Estimate {
  id: string;
  transactionNumber: string;
  entityId: string;
  customerName: string;
  transactionDate: string;
  estimateValidUntil: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  salesStage: 'LEAD' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST';
  probability: number;
  lines: EstimateLine[];
}

interface EstimateLine {
  id: string;
  itemId: string;
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  lineAmount: number;
  taxAmount: number;
  totalLineAmount: number;
}

// Form schemas
const estimateLineSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  description: z.string().min(1, "Description is required"),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  unitPrice: z.number().min(0, "Unit price must be positive"),
  discountPercent: z.number().min(0).max(100, "Discount must be between 0 and 100").optional(),
});

const estimateFormSchema = z.object({
  entityId: z.string().min(1, "Customer is required"),
  transactionDate: z.string().min(1, "Transaction date is required"),
  estimateValidUntil: z.string().min(1, "Valid until date is required"),
  memo: z.string().max(1000, "Memo too long").optional(),
  salesStage: z.enum(['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST']),
  probability: z.number().min(0).max(100, "Probability must be between 0 and 100"),
  lines: z.array(estimateLineSchema).min(1, "At least one line item is required"),
});

type EstimateFormValues = z.infer<typeof estimateFormSchema>;

export default function EstimatesPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null);
  const { orgId } = useAuth();
  
  // Mock data for now - replace with TRPC when available
  const estimates: Estimate[] = [];
  const customers = [
    { id: '1', name: 'Acme Corp', email: 'contact@acme.com' },
    { id: '2', name: 'Tech Solutions Inc', email: 'info@techsolutions.com' },
  ];
  const items = [
    { id: '1', name: 'Consulting Services', price: 150.00 },
    { id: '2', name: 'Software License', price: 299.99 },
    { id: '3', name: 'Training Session', price: 500.00 },
  ];

  const form = useForm<EstimateFormValues>({
    resolver: zodResolver(estimateFormSchema),
    defaultValues: {
      entityId: "",
      transactionDate: new Date().toISOString().split('T')[0],
      estimateValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
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

  // Handle add estimate
  const handleAddEstimate = async (values: EstimateFormValues) => {
    try {
      // TODO: Implement TRPC mutation
      toast.success('Estimate created successfully');
      setIsAddDialogOpen(false);
      form.reset();
    } catch (error) {
      toast.error('Failed to create estimate');
    }
  };

  // Handle convert to sales order
  const handleConvertToSalesOrder = async (estimate: Estimate) => {
    try {
      // TODO: Implement TRPC mutation to convert estimate to sales order
      toast.success('Estimate converted to sales order');
    } catch (error) {
      toast.error('Failed to convert estimate');
    }
  };

  // Handle delete estimate
  const handleDeleteEstimate = async () => {
    try {
      // TODO: Implement TRPC mutation
      toast.success('Estimate deleted successfully');
      setIsDeleteDialogOpen(false);
    } catch (error) {
      toast.error('Failed to delete estimate');
    }
  };

  // Calculate line totals
  const calculateLineTotal = (quantity: number, unitPrice: number, discountPercent: number = 0) => {
    const subtotal = quantity * unitPrice;
    const discountAmount = subtotal * (discountPercent / 100);
    return subtotal - discountAmount;
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'outline';
      case 'SENT': return 'default';
      case 'ACCEPTED': return 'default';
      case 'DECLINED': return 'destructive';
      case 'EXPIRED': return 'secondary';
      default: return 'outline';
    }
  };

  const getStageBadgeVariant = (stage: string) => {
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

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view estimates.</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Sales Estimates</h1>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Estimate
        </Button>
      </div>

      <Table>
        <TableCaption>A list of sales estimates.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Estimate #</TableHead>
            <TableHead>Customer</TableHead>
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
            estimates.map((estimate) => (
              <TableRow key={estimate.id}>
                <TableCell className="font-medium">{estimate.transactionNumber}</TableCell>
                <TableCell>{estimate.customerName}</TableCell>
                <TableCell>{new Date(estimate.transactionDate).toLocaleDateString()}</TableCell>
                <TableCell>{new Date(estimate.estimateValidUntil).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">${estimate.totalAmount.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(estimate.status)}>
                    {estimate.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={getStageBadgeVariant(estimate.salesStage)}>
                    {estimate.salesStage}
                  </Badge>
                </TableCell>
                <TableCell>{estimate.probability}%</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedEstimate(estimate);
                        setIsViewDialogOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleConvertToSalesOrder(estimate)}
                      title="Convert to Sales Order"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedEstimate(estimate);
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
              Create a new sales estimate for a customer.
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
                      <FormLabel>Customer</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name}
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
                  name="transactionDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimate Date</FormLabel>
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
                  name="estimateValidUntil"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valid Until</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                          <SelectItem value="LEAD">Lead</SelectItem>
                          <SelectItem value="QUALIFIED">Qualified</SelectItem>
                          <SelectItem value="PROPOSAL">Proposal</SelectItem>
                          <SelectItem value="NEGOTIATION">Negotiation</SelectItem>
                          <SelectItem value="CLOSED_WON">Closed Won</SelectItem>
                          <SelectItem value="CLOSED_LOST">Closed Lost</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select item" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {items.map((item) => (
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
                            <FormLabel>Description</FormLabel>
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
                            <FormLabel>Quantity</FormLabel>
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
                            <FormLabel>Unit Price</FormLabel>
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
                <Button type="submit">
                  Create Estimate
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Estimate Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Estimate Details</DialogTitle>
            <DialogDescription>
              View estimate {selectedEstimate?.transactionNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedEstimate && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Estimate Number</label>
                  <p className="text-sm">{selectedEstimate.transactionNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Customer</label>
                  <p className="text-sm">{selectedEstimate.customerName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Date</label>
                  <p className="text-sm">{new Date(selectedEstimate.transactionDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Valid Until</label>
                  <p className="text-sm">{new Date(selectedEstimate.estimateValidUntil).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Sales Stage</label>
                  <p className="text-sm">{selectedEstimate.salesStage}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Win Probability</label>
                  <p className="text-sm">{selectedEstimate.probability}%</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Line Items</label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedEstimate.lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.itemName}</TableCell>
                        <TableCell>{line.quantity}</TableCell>
                        <TableCell>${line.unitPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${line.totalLineAmount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg">
                <span className="text-lg font-semibold">Total Amount</span>
                <span className="text-lg font-bold">${selectedEstimate.totalAmount.toFixed(2)}</span>
              </div>
            </div>
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
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}