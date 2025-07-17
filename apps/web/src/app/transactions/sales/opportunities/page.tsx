'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Eye, TrendingUp, FileText } from 'lucide-react';
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

// Define interfaces for the Opportunity data
interface Opportunity {
  id: string;
  transactionNumber: string;
  entityId: string;
  customerName: string;
  transactionDate: string;
  expectedCloseDate: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  salesStage: 'LEAD' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST';
  probability: number;
  leadSource: string;
  competitor?: string;
  description: string;
  lines: OpportunityLine[];
}

interface OpportunityLine {
  id: string;
  itemId: string;
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  lineAmount: number;
  estimatedHours?: number;
  hourlyRate?: number;
  totalLineAmount: number;
}

// Form schemas
const opportunityLineSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  description: z.string().min(1, "Description is required"),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  unitPrice: z.number().min(0, "Unit price must be positive"),
  discountPercent: z.number().min(0).max(100, "Discount must be between 0 and 100").optional(),
  estimatedHours: z.number().min(0, "Estimated hours must be positive").optional(),
  hourlyRate: z.number().min(0, "Hourly rate must be positive").optional(),
});

const opportunityFormSchema = z.object({
  entityId: z.string().min(1, "Customer is required"),
  transactionDate: z.string().min(1, "Transaction date is required"),
  expectedCloseDate: z.string().min(1, "Expected close date is required"),
  description: z.string().min(1, "Description is required").max(1000),
  salesStage: z.enum(['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST']),
  probability: z.number().min(0).max(100, "Probability must be between 0 and 100"),
  leadSource: z.string().min(1, "Lead source is required"),
  competitor: z.string().optional(),
  lines: z.array(opportunityLineSchema).min(1, "At least one line item is required"),
});

type OpportunityFormValues = z.infer<typeof opportunityFormSchema>;

export default function OpportunitiesPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const { orgId } = useAuth();
  
  // Mock data for now - replace with TRPC when available
  const opportunities: Opportunity[] = [];
  const customers = [
    { id: '1', name: 'Acme Corp', email: 'contact@acme.com' },
    { id: '2', name: 'Tech Solutions Inc', email: 'info@techsolutions.com' },
    { id: '3', name: 'Global Industries', email: 'business@global.com' },
  ];
  const items = [
    { id: '1', name: 'Consulting Services', price: 150.00 },
    { id: '2', name: 'Software Implementation', price: 5000.00 },
    { id: '3', name: 'Training Program', price: 2500.00 },
  ];
  const leadSources = [
    'Website',
    'Referral',
    'Cold Call',
    'Email Campaign',
    'Social Media',
    'Trade Show',
    'Partner',
    'Advertisement',
  ];

  const form = useForm<OpportunityFormValues>({
    resolver: zodResolver(opportunityFormSchema),
    defaultValues: {
      entityId: "",
      transactionDate: new Date().toISOString().split('T')[0],
      expectedCloseDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 60 days from now
      description: "",
      salesStage: "LEAD",
      probability: 25,
      leadSource: "",
      competitor: "",
      lines: [
        { itemId: "", description: "", quantity: 1, unitPrice: 0, discountPercent: 0, estimatedHours: 0, hourlyRate: 0 },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  // Handle add opportunity
  const handleAddOpportunity = async (values: OpportunityFormValues) => {
    try {
      // TODO: Implement TRPC mutation
      toast.success('Opportunity created successfully');
      setIsAddDialogOpen(false);
      form.reset();
    } catch (error) {
      toast.error('Failed to create opportunity');
    }
  };

  // Handle convert to estimate
  const handleConvertToEstimate = async (opportunity: Opportunity) => {
    try {
      // TODO: Implement TRPC mutation to convert opportunity to estimate
      toast.success('Opportunity converted to estimate');
    } catch (error) {
      toast.error('Failed to convert opportunity');
    }
  };

  // Handle delete opportunity
  const handleDeleteOpportunity = async () => {
    try {
      // TODO: Implement TRPC mutation
      toast.success('Opportunity deleted successfully');
      setIsDeleteDialogOpen(false);
    } catch (error) {
      toast.error('Failed to delete opportunity');
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

  const getProbabilityColor = (probability: number) => {
    if (probability >= 75) return 'text-green-600';
    if (probability >= 50) return 'text-yellow-600';
    if (probability >= 25) return 'text-orange-600';
    return 'text-red-600';
  };

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view opportunities.</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Sales Opportunities</h1>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Opportunity
        </Button>
      </div>

      <Table>
        <TableCaption>A list of sales opportunities.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Opportunity #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Expected Close</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Probability</TableHead>
            <TableHead>Lead Source</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {opportunities.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                No opportunities found. Create your first opportunity to get started.
              </TableCell>
            </TableRow>
          ) : (
            opportunities.map((opportunity) => (
              <TableRow key={opportunity.id}>
                <TableCell className="font-medium">{opportunity.transactionNumber}</TableCell>
                <TableCell>{opportunity.customerName}</TableCell>
                <TableCell className="max-w-xs truncate">{opportunity.description}</TableCell>
                <TableCell>{new Date(opportunity.expectedCloseDate).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">${opportunity.totalAmount.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={getStageBadgeVariant(opportunity.salesStage)}>
                    {opportunity.salesStage}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className={`font-medium ${getProbabilityColor(opportunity.probability)}`}>
                    {opportunity.probability}%
                  </span>
                </TableCell>
                <TableCell>{opportunity.leadSource}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedOpportunity(opportunity);
                        setIsViewDialogOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleConvertToEstimate(opportunity)}
                      title="Convert to Estimate"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedOpportunity(opportunity);
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

      {/* Add Opportunity Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Sales Opportunity</DialogTitle>
            <DialogDescription>
              Create a new sales opportunity to track potential deals.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddOpportunity)} className="space-y-4">
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
                      <FormLabel>Opportunity Date</FormLabel>
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
                  name="expectedCloseDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Close Date</FormLabel>
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

              <div className="grid grid-cols-2 gap-4">
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
                  name="leadSource"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lead Source</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select lead source" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {leadSources.map((source) => (
                            <SelectItem key={source} value={source}>
                              {source}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="competitor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Competitor (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Main competitor..." {...field} />
                    </FormControl>
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
                      <Textarea placeholder="Opportunity description..." {...field} />
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
                    onClick={() => append({ itemId: "", description: "", quantity: 1, unitPrice: 0, discountPercent: 0, estimatedHours: 0, hourlyRate: 0 })}
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
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                      <FormField
                        control={form.control}
                        name={`lines.${index}.estimatedHours`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Est. Hours</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.5"
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
                        name={`lines.${index}.hourlyRate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hourly Rate</FormLabel>
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
                    </div>
                  </div>
                ))}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Create Opportunity
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Opportunity Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Opportunity Details</DialogTitle>
            <DialogDescription>
              View opportunity {selectedOpportunity?.transactionNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedOpportunity && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Opportunity Number</label>
                  <p className="text-sm">{selectedOpportunity.transactionNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Customer</label>
                  <p className="text-sm">{selectedOpportunity.customerName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Expected Close Date</label>
                  <p className="text-sm">{new Date(selectedOpportunity.expectedCloseDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Sales Stage</label>
                  <p className="text-sm">
                    <Badge variant={getStageBadgeVariant(selectedOpportunity.salesStage)}>
                      {selectedOpportunity.salesStage}
                    </Badge>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Win Probability</label>
                  <p className={`text-sm font-medium ${getProbabilityColor(selectedOpportunity.probability)}`}>
                    {selectedOpportunity.probability}%
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Lead Source</label>
                  <p className="text-sm">{selectedOpportunity.leadSource}</p>
                </div>
              </div>
              {selectedOpportunity.competitor && (
                <div>
                  <label className="text-sm font-medium">Competitor</label>
                  <p className="text-sm">{selectedOpportunity.competitor}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium">Description</label>
                <p className="text-sm">{selectedOpportunity.description}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Line Items</label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOpportunity.lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.itemName}</TableCell>
                        <TableCell>{line.quantity}</TableCell>
                        <TableCell>${line.unitPrice.toFixed(2)}</TableCell>
                        <TableCell>{line.estimatedHours || '-'}</TableCell>
                        <TableCell className="text-right">${line.totalLineAmount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg">
                <span className="text-lg font-semibold">Total Opportunity Value</span>
                <span className="text-lg font-bold">${selectedOpportunity.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Opportunity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete opportunity {selectedOpportunity?.transactionNumber}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOpportunity}
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