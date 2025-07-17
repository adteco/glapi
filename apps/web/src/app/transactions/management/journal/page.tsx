'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Eye } from 'lucide-react';
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

// Define interfaces for the Journal Entry data
interface JournalEntry {
  id: string;
  transactionNumber: string;
  transactionDate: string;
  description: string;
  totalDebitAmount: number;
  totalCreditAmount: number;
  status: 'DRAFT' | 'POSTED' | 'REVERSED';
  createdAt: Date;
  lines: JournalEntryLine[];
}

interface JournalEntryLine {
  id: string;
  lineNumber: number;
  accountId: string;
  accountNumber: string;
  accountName: string;
  debitAmount: number;
  creditAmount: number;
  description: string;
}

// Form schemas
const journalEntryLineSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  debitAmount: z.number().min(0, "Debit amount must be positive").optional(),
  creditAmount: z.number().min(0, "Credit amount must be positive").optional(),
  description: z.string().max(500, "Description too long").optional(),
});

const journalEntryFormSchema = z.object({
  transactionDate: z.string().min(1, "Transaction date is required"),
  description: z.string().min(1, "Description is required").max(500),
  lines: z.array(journalEntryLineSchema).min(2, "At least 2 lines required"),
}).refine((data) => {
  const totalDebits = data.lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
  const totalCredits = data.lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);
  return Math.abs(totalDebits - totalCredits) < 0.01;
}, {
  message: "Total debits must equal total credits",
  path: ["lines"],
});

type JournalEntryFormValues = z.infer<typeof journalEntryFormSchema>;

export default function JournalEntryPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const { orgId } = useAuth();
  
  // Mock data for now - replace with TRPC when available
  const journalEntries: JournalEntry[] = [];
  const accounts = [
    { id: '1', accountNumber: '1000', accountName: 'Cash' },
    { id: '2', accountNumber: '2000', accountName: 'Accounts Payable' },
    { id: '3', accountNumber: '4000', accountName: 'Revenue' },
    { id: '4', accountNumber: '5000', accountName: 'Expenses' },
  ];

  const form = useForm<JournalEntryFormValues>({
    resolver: zodResolver(journalEntryFormSchema),
    defaultValues: {
      transactionDate: new Date().toISOString().split('T')[0],
      description: "",
      lines: [
        { accountId: "", debitAmount: 0, creditAmount: 0, description: "" },
        { accountId: "", debitAmount: 0, creditAmount: 0, description: "" },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  // Handle add journal entry
  const handleAddJournalEntry = async (values: JournalEntryFormValues) => {
    try {
      // TODO: Implement TRPC mutation
      toast.success('Journal entry created successfully');
      setIsAddDialogOpen(false);
      form.reset();
    } catch (error) {
      toast.error('Failed to create journal entry');
    }
  };

  // Handle delete journal entry
  const handleDeleteJournalEntry = async () => {
    try {
      // TODO: Implement TRPC mutation
      toast.success('Journal entry deleted successfully');
      setIsDeleteDialogOpen(false);
    } catch (error) {
      toast.error('Failed to delete journal entry');
    }
  };

  // Calculate totals
  const watchedLines = form.watch("lines");
  const totalDebits = watchedLines?.reduce((sum, line) => sum + (line.debitAmount || 0), 0) || 0;
  const totalCredits = watchedLines?.reduce((sum, line) => sum + (line.creditAmount || 0), 0) || 0;
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'outline';
      case 'POSTED': return 'default';
      case 'REVERSED': return 'destructive';
      default: return 'outline';
    }
  };

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view journal entries.</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Journal Entries</h1>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Journal Entry
        </Button>
      </div>

      <Table>
        <TableCaption>A list of journal entries.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Number</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Debit</TableHead>
            <TableHead className="text-right">Credit</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {journalEntries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                No journal entries found. Create your first journal entry to get started.
              </TableCell>
            </TableRow>
          ) : (
            journalEntries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">{entry.transactionNumber}</TableCell>
                <TableCell>{new Date(entry.transactionDate).toLocaleDateString()}</TableCell>
                <TableCell>{entry.description}</TableCell>
                <TableCell className="text-right">${entry.totalDebitAmount.toFixed(2)}</TableCell>
                <TableCell className="text-right">${entry.totalCreditAmount.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(entry.status)}>
                    {entry.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedEntry(entry);
                        setIsViewDialogOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedEntry(entry);
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

      {/* Add Journal Entry Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Journal Entry</DialogTitle>
            <DialogDescription>
              Create a new journal entry with multiple lines.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddJournalEntry)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="transactionDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transaction Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
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
                        <Input placeholder="Journal entry description..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Journal Entry Lines</h3>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => append({ accountId: "", debitAmount: 0, creditAmount: 0, description: "" })}
                  >
                    Add Line
                  </Button>
                </div>

                {fields.map((field, index) => (
                  <div key={field.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Line {index + 1}</span>
                      {fields.length > 2 && (
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
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.accountId`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Account</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select account" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {accounts.map((account) => (
                                  <SelectItem key={account.id} value={account.id}>
                                    {account.accountNumber} - {account.accountName}
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
                        name={`lines.${index}.debitAmount`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Debit Amount</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
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
                        name={`lines.${index}.creditAmount`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Credit Amount</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
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
                        name={`lines.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Line Description</FormLabel>
                            <FormControl>
                              <Input placeholder="Optional description..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                ))}

                <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg">
                  <div className="flex gap-4">
                    <span className="text-sm font-medium">Total Debits: ${totalDebits.toFixed(2)}</span>
                    <span className="text-sm font-medium">Total Credits: ${totalCredits.toFixed(2)}</span>
                  </div>
                  <Badge variant={isBalanced ? "default" : "destructive"}>
                    {isBalanced ? "Balanced" : "Out of Balance"}
                  </Badge>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!isBalanced}>
                  Create Journal Entry
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Journal Entry Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Journal Entry Details</DialogTitle>
            <DialogDescription>
              View journal entry {selectedEntry?.transactionNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Transaction Number</label>
                  <p className="text-sm">{selectedEntry.transactionNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Date</label>
                  <p className="text-sm">{new Date(selectedEntry.transactionDate).toLocaleDateString()}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <p className="text-sm">{selectedEntry.description}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Lines</label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedEntry.lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.accountNumber} - {line.accountName}</TableCell>
                        <TableCell>{line.description}</TableCell>
                        <TableCell className="text-right">
                          {line.debitAmount > 0 ? `$${line.debitAmount.toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {line.creditAmount > 0 ? `$${line.creditAmount.toFixed(2)}` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Journal Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete journal entry {selectedEntry?.transactionNumber}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteJournalEntry}
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