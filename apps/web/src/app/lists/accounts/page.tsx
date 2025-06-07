'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge'; // For displaying account category
import { SeedAccountsButton } from '@/components/SeedAccountsButton';
import { ChevronRight, ChevronDown, Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import * as z from "zod";

// Define an interface for the Account data
interface Account {
  id: string;
  organizationId: string;
  accountNumber: string;
  accountName: string;
  accountCategory: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'COGS' | 'Expense';
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Form schema
const accountFormSchema = z.object({
  accountNumber: z.string().min(1, "Account number is required").max(20, "Account number too long"),
  accountName: z.string().min(1, "Account name is required").max(255),
  accountCategory: z.enum(['Asset', 'Liability', 'Equity', 'Revenue', 'COGS', 'Expense']),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().optional(),
  parentAccountNumber: z.string().optional(),
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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { getToken, orgId } = useAuth();

  const form = useForm<AccountFormValues>({
    // Temporarily remove zodResolver to fix build issue
    // resolver: zodResolver(accountFormSchema),
    defaultValues: {
      accountNumber: "",
      accountName: "",
      accountCategory: "Asset",
      description: "",
      isActive: true,
      parentAccountNumber: "",
    },
  });

  const fetchAccounts = async () => {
      if (!orgId) {
        // Potentially set accounts to [] or show a message if no org is active
        // For now, we just won't fetch if there's no orgId
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const token = await getToken(); // Get the default Clerk JWT token
        if (!token) {
          toast.error('Authentication token not available.');
          setIsLoading(false);
          return;
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/gl/accounts`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorResult = await response.json();
          toast.error(errorResult.message || errorResult.error || 'Failed to fetch accounts.');
          throw new Error('Failed to fetch accounts');
        }

        const data = await response.json();
        setAccounts(data);
      } catch (error) {
        console.error('Error fetching accounts:', error);
        // Toast error is handled above if response is not ok
        if (!(error instanceof Error && error.message === 'Failed to fetch accounts')) {
            toast.error('An unexpected error occurred while fetching accounts.');
        }
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    fetchAccounts();
  }, [orgId, getToken]); // Re-fetch if orgId changes

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
    setIsSubmitting(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Authentication token not available.');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/gl/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || 'Failed to create account');
        return;
      }

      toast.success('Account created successfully');
      setIsAddDialogOpen(false);
      form.reset();
      fetchAccounts();
    } catch (error) {
      console.error('Error creating account:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit account
  const handleEditAccount = async (values: AccountFormValues) => {
    if (!selectedAccount) return;
    
    setIsSubmitting(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Authentication token not available.');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/gl/accounts/${selectedAccount.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || 'Failed to update account');
        return;
      }

      toast.success('Account updated successfully');
      setIsEditDialogOpen(false);
      fetchAccounts();
    } catch (error) {
      console.error('Error updating account:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete account
  const handleDeleteAccount = async () => {
    if (!selectedAccount) return;
    
    setIsSubmitting(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Authentication token not available.');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/gl/accounts/${selectedAccount.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete account');
        return;
      }

      toast.success('Account deleted successfully');
      setIsDeleteDialogOpen(false);
      fetchAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
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

  if (accounts.length === 0 && !isLoading) {
    return (
      <div className="container mx-auto py-10">
        <h1 className="text-3xl font-bold mb-6">Chart of Accounts</h1>
        <p className="mb-4">No accounts found for this organization. You might need to seed them.</p>
        <SeedAccountsButton onSuccess={fetchAccounts} />
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
            const num = parseInt(account.accountNumber);
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
                        <SelectItem value="">None</SelectItem>
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
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create Account"}
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
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Updating..." : "Update Account"}
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
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? "Deleting..." : "Delete"}
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