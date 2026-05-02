'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { SeedAccountsButton } from '@/components/SeedAccountsButton';
import { ChevronRight, ChevronDown, Plus, Edit, Trash2 } from 'lucide-react';
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
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { newAccountSchema } from "@glapi/types";

// Define an interface for the Account data matching TRPC return type
interface Account {
  id: string;
  organizationId: string;
  accountNumber: string;
  accountName: string;
  accountCategory: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'COGS' | 'Expense';
  accountSubcategory?: string | null;
  normalBalance?: string | null;
  financialStatementLine?: string | null;
  isControlAccount: boolean;
  rollupAccountId?: string | null;
  gaapClassification?: string | null;
  cashFlowCategory?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Form schema - use centralized schema from @glapi/types
const accountFormSchema = newAccountSchema.extend({
  parentAccountNumber: z.string().optional(),
}).omit({
  normalBalance: true,
  financialStatementLine: true,
  isControlAccount: true,
  rollupAccountId: true,
  gaapClassification: true,
  cashFlowCategory: true,
  accountSubcategory: true,
});

type AccountFormValues = z.infer<typeof accountFormSchema>;

// Helper function to determine if an account is a parent account
function isParentAccount(accountNumber: string): boolean {
  // Parent accounts are: 10000, 20000, 30000, 40000, 50000, 60000, 70000, 80000, 90000
  return accountNumber.endsWith('0000');
}

// Helper function to get parent account number
function getParentAccountNumber(accountNumber: string): string | null {
  const num = parseInt(accountNumber);
  
  // For accounts like 11000, 12000, etc., the parent is 10000
  if (num >= 11000 && num < 20000) return '10000';
  if (num >= 21000 && num < 30000) return '20000';
  if (num >= 31000 && num < 40000) return '30000';
  if (num >= 41000 && num < 50000) return '40000';
  if (num >= 51000 && num < 60000) return '50000';
  if (num >= 61000 && num < 70000) return '60000';
  if (num >= 71000 && num < 80000) return '70000';
  if (num >= 81000 && num < 90000) return '80000';
  if (num >= 91000 && num < 100000) return '90000';
  
  // For sub-accounts like 70100, 70200, the parent is 70000
  if (accountNumber.length >= 5 && !accountNumber.endsWith('000')) {
    const parentCandidate = accountNumber.substring(0, 2) + '000';
    // Only return if this parent actually exists in our structure
    if (num % 1000 !== 0) {
      return parentCandidate;
    }
  }
  
  return null;
}

export default function AccountsPage() {
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const { orgId } = useAuth();
  
  // TRPC queries and mutations
  const { data: accountsData, error: accountsError, isLoading, refetch } = trpc.accounts.list.useQuery({}, {
    enabled: !!orgId,
  });
  
  const createAccountMutation = trpc.accounts.create.useMutation({
    onSuccess: () => {
      toast.success('Account created successfully');
      setIsAddDialogOpen(false);
      form.reset();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create account');
    },
  });
  
  const updateAccountMutation = trpc.accounts.update.useMutation({
    onSuccess: () => {
      toast.success('Account updated successfully');
      setIsEditDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update account');
    },
  });
  
  const deleteAccountMutation = trpc.accounts.delete.useMutation({
    onSuccess: () => {
      toast.success('Account deleted successfully');
      setIsDeleteDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete account');
    },
  });

  const accounts = useMemo(() => accountsData?.data || [], [accountsData?.data]);

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      accountNumber: "",
      accountName: "",
      accountCategory: "Asset",
      description: "",
      isActive: true,
      parentAccountNumber: "",
    },
  });


  // Toggle expansion of a parent account
  const toggleExpanded = (accountNumber: string) => {
    setExpandedAccounts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(accountNumber)) {
        newSet.delete(accountNumber);
      } else {
        newSet.add(accountNumber);
      }
      return newSet;
    });
  };

  // Handle add account
  const handleAddAccount = async (values: AccountFormValues) => {
    // Transform null values to undefined for the mutation
    createAccountMutation.mutate({
      ...values,
      description: values.description ?? undefined,
    });
  };

  // Handle edit account
  const handleEditAccount = async (values: AccountFormValues) => {
    if (!selectedAccount) return;
    updateAccountMutation.mutate({
      id: selectedAccount.id,
      data: {
        ...values,
        description: values.description ?? undefined,
      },
    });
  };

  // Handle delete account
  const handleDeleteAccount = async () => {
    if (!selectedAccount) return;
    deleteAccountMutation.mutate({ id: selectedAccount.id });
  };

  // Open edit dialog with account data
  const openEditDialog = (account: Account) => {
    setSelectedAccount(account);
    form.reset({
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      accountCategory: account.accountCategory,
      description: account.description || "",
      isActive: account.isActive,
      parentAccountNumber: getParentAccountNumber(account.accountNumber) || "",
    });
    setIsEditDialogOpen(true);
  };

  // Filter and organize accounts for display
  const displayedAccounts = useMemo(() => {
    const sortedAccounts = [...accounts].sort((a, b) => 
      a.accountNumber.localeCompare(b.accountNumber)
    );

    const result: Account[] = [];
    
    for (const account of sortedAccounts) {
      const parentNumber = getParentAccountNumber(account.accountNumber);
      
      // Always show top-level accounts and parent accounts
      if (!parentNumber || isParentAccount(account.accountNumber)) {
        result.push(account);
      } 
      // Only show child accounts if their parent is expanded
      else if (parentNumber && expandedAccounts.has(parentNumber)) {
        result.push(account);
      }
    }
    
    return result;
  }, [accounts, expandedAccounts]);

  if (isLoading) {
    return <div className="container mx-auto py-10"><p>Loading accounts...</p></div>;
  }

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view accounts.</p></div>;
  }

  if (accountsError) {
    return (
      <div className="container mx-auto py-10">
        <h1 className="text-3xl font-bold mb-6">Chart of Accounts</h1>
        <p className="mb-4 text-destructive">
          {accountsError.data?.code === 'UNAUTHORIZED'
            ? 'You are not authorized to view accounts for the selected organization.'
            : accountsError.message}
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (accounts.length === 0 && !isLoading) {
    return (
      <div className="container mx-auto py-10">
        <h1 className="text-3xl font-bold mb-6">Chart of Accounts</h1>
        <p className="mb-4">No accounts found for this organization. You might need to seed them.</p>
        <SeedAccountsButton onSuccess={refetch} />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Chart of Accounts</h1>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </div>
      <Table>
        <TableCaption>A list of your organization's accounts.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[150px]">Number</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-center">Active</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayedAccounts.map((account) => {
            const isTopLevel = account.accountNumber.endsWith('0000'); // 10000, 20000, etc.
            const isSecondLevel = !isTopLevel && account.accountNumber.endsWith('000'); // 11000, 12000, etc.
            const isThirdLevel = !isTopLevel && !isSecondLevel; // 70100, 70200, etc.
            
            const hasChildren = accounts.some(a => 
              getParentAccountNumber(a.accountNumber) === account.accountNumber
            );
            const isExpanded = expandedAccounts.has(account.accountNumber);
            
            // Determine indentation level
            let indentClass = "";
            let nameIndentClass = "";
            if (isSecondLevel) {
              indentClass = "ml-6";
              nameIndentClass = "ml-11";
            } else if (isThirdLevel) {
              indentClass = "ml-12";
              nameIndentClass = "ml-17";
            }
            
            return (
              <TableRow key={account.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center">
                    {hasChildren && (
                      <button
                        onClick={() => toggleExpanded(account.accountNumber)}
                        className="mr-1 p-0.5 hover:bg-gray-100 rounded"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    {!hasChildren && !isTopLevel && (
                      <span className="w-5 inline-block" />
                    )}
                    <span className={indentClass}>
                      {account.accountNumber}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={nameIndentClass}>
                    {account.accountName}
                  </span>
                </TableCell>
                <TableCell><Badge variant={getBadgeVariantForCategory(account.accountCategory)}>{account.accountCategory}</Badge></TableCell>
                <TableCell>{account.description || '-'}</TableCell>
                <TableCell className="text-center">{account.isActive ? 'Yes' : 'No'}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(account)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedAccount(account);
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Add Account Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add New Account</DialogTitle>
            <DialogDescription>
              Create a new account in your chart of accounts.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddAccount)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="accountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Number</FormLabel>
                      <FormControl>
                        <Input placeholder="10100" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="accountCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Asset">Asset</SelectItem>
                          <SelectItem value="Liability">Liability</SelectItem>
                          <SelectItem value="Equity">Equity</SelectItem>
                          <SelectItem value="Revenue">Revenue</SelectItem>
                          <SelectItem value="COGS">Cost of Goods Sold</SelectItem>
                          <SelectItem value="Expense">Expense</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="accountName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Cash in Bank" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parentAccountNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent Account (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select parent account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {accounts
                          .filter(a => a.accountNumber.endsWith('000') || a.accountNumber.endsWith('0000'))
                          .map(account => (
                            <SelectItem key={account.id} value={account.accountNumber}>
                              {account.accountNumber} - {account.accountName}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select a parent account to create a sub-account
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
                      <Textarea 
                        placeholder="Account description..." 
                        {...field} 
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Set whether this account is currently active
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
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createAccountMutation.isPending}>
                  {createAccountMutation.isPending ? "Creating..." : "Create Account"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Account Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>
              Update the account details.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEditAccount)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="accountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Number</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="accountCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Asset">Asset</SelectItem>
                          <SelectItem value="Liability">Liability</SelectItem>
                          <SelectItem value="Equity">Equity</SelectItem>
                          <SelectItem value="Revenue">Revenue</SelectItem>
                          <SelectItem value="COGS">Cost of Goods Sold</SelectItem>
                          <SelectItem value="Expense">Expense</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="accountName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                      <Textarea 
                        {...field} 
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Set whether this account is currently active
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
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateAccountMutation.isPending}>
                  {updateAccountMutation.isPending ? "Updating..." : "Update Account"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete account {selectedAccount?.accountNumber} - {selectedAccount?.accountName}?
              This action cannot be undone and will only work if there are no transactions using this account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleteAccountMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteAccountMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Helper function to determine badge color based on category (optional styling)
function getBadgeVariantForCategory(category: Account['accountCategory']): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (category) {
        case 'Asset': return 'default';
        case 'Liability': return 'secondary';
        case 'Equity': return 'default'; // Or another color
        case 'Revenue': return 'default'; // Consider success variant if available
        case 'COGS': return 'outline';
        case 'Expense': return 'destructive';
        default: return 'outline';
    }
}
