'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';
import { Eye, Pencil, Trash2, Plus, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface ProspectMetadata {
  prospect_source?: string;
  prospect_status?: string;
  qualification_score?: number;
  next_action?: string;
  follow_up_date?: string;
  industry?: string;
  annualRevenue?: number;
  numberOfEmployees?: number;
  assignedTo?: string;
}

interface Prospect {
  id: string;
  name: string;
  displayName?: string | null;
  entityId?: string | null;
  code?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  metadata?: ProspectMetadata | null;
  status: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ProspectsPage() {
  const { orgId } = useAuth();
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // TRPC queries and mutations
  const { data: prospectsData, isLoading, refetch } = trpc.prospects.list.useQuery({}, {
    enabled: !!orgId,
  });

  const createProspectMutation = trpc.prospects.create.useMutation({
    onSuccess: () => {
      toast.success('Prospect created successfully');
      setIsCreateOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create prospect');
    },
  });

  const convertToLeadMutation = trpc.prospects.convertToLead.useMutation({
    onSuccess: () => {
      toast.success('Successfully converted prospect to lead');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to convert prospect to lead');
    },
  });

  const convertToCustomerMutation = trpc.prospects.convertToCustomer.useMutation({
    onSuccess: () => {
      toast.success('Successfully converted prospect to customer');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to convert prospect to customer');
    },
  });

  const prospects = prospectsData?.data || [];

  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    email: '',
    phone: '',
    website: '',
    notes: '',
    metadata: {
      prospect_source: '',
      industry: '',
      annualRevenue: 0,
      numberOfEmployees: 0,
      assignedTo: '',
    }
  });

  const handleCreate = async () => {
    if (!formData.name) {
      toast.error('Company name is required');
      return;
    }

    createProspectMutation.mutate({
      name: formData.name,
      legalName: formData.displayName || undefined,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      website: formData.website || undefined,
      notes: formData.notes || undefined,
      isActive: true,
      metadata: {
        prospect_source: formData.metadata.prospect_source || undefined,
        industry: formData.metadata.industry || undefined,
        annualRevenue: formData.metadata.annualRevenue || undefined,
        numberOfEmployees: formData.metadata.numberOfEmployees || undefined,
        assignedTo: formData.metadata.assignedTo || undefined,
      },
    });
  };

  const handleConvert = async (prospectId: string, convertTo: 'lead' | 'customer') => {
    const confirmMsg = convertTo === 'lead' 
      ? 'Convert this prospect to a lead?' 
      : 'Convert this prospect directly to a customer?';
      
    if (!confirm(confirmMsg)) return;
    
    if (convertTo === 'lead') {
      convertToLeadMutation.mutate({ id: prospectId });
    } else {
      convertToCustomerMutation.mutate({ id: prospectId });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      displayName: '',
      email: '',
      phone: '',
      website: '',
      notes: '',
      metadata: {
        prospect_source: '',
        industry: '',
        annualRevenue: 0,
        numberOfEmployees: 0,
        assignedTo: '',
      }
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Prospects</CardTitle>
              <CardDescription>Track potential opportunities before they become leads</CardDescription>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Prospect
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Prospect</DialogTitle>
                  <DialogDescription>Add a new prospect to track</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Company Name*</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="source">Source</Label>
                      <Input
                        id="source"
                        value={formData.metadata.prospect_source}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          metadata: { ...formData.metadata, prospect_source: e.target.value }
                        })}
                        placeholder="e.g., Cold Outreach, Research"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="industry">Industry</Label>
                      <Input
                        id="industry"
                        value={formData.metadata.industry}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          metadata: { ...formData.metadata, industry: e.target.value }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="revenue">Estimated Annual Revenue</Label>
                      <Input
                        id="revenue"
                        type="number"
                        value={formData.metadata.annualRevenue}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          metadata: { ...formData.metadata, annualRevenue: Number(e.target.value) }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employees">Number of Employees</Label>
                      <Input
                        id="employees"
                        type="number"
                        value={formData.metadata.numberOfEmployees}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          metadata: { ...formData.metadata, numberOfEmployees: Number(e.target.value) }
                        })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Additional notes about this prospect"
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={createProspectMutation.isPending}>
                    {createProspectMutation.isPending ? 'Creating...' : 'Create'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prospects.map((prospect) => (
                <TableRow key={prospect.id}>
                  <TableCell className="font-medium">
                    {prospect.displayName || prospect.name}
                  </TableCell>
                  <TableCell>{prospect.metadata?.industry || '-'}</TableCell>
                  <TableCell>
                    {prospect.metadata?.annualRevenue ? formatCurrency(prospect.metadata.annualRevenue) : '-'}
                  </TableCell>
                  <TableCell>{prospect.metadata?.numberOfEmployees || '-'}</TableCell>
                  <TableCell>{prospect.email || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={prospect.isActive ? 'default' : 'secondary'}>
                      {prospect.isActive ? 'active' : 'inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => router.push(`/relationships/prospects/${prospect.id}`)}
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">View</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => router.push(`/relationships/prospects/${prospect.id}/edit`)}
                        title="Edit prospect"
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleConvert(prospect.id, 'lead')}
                        disabled={convertToLeadMutation.isPending}
                        title="Convert to lead"
                      >
                        <ArrowRight className="h-4 w-4" />
                        <span className="sr-only">Convert to Lead</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleConvert(prospect.id, 'customer')}
                        disabled={convertToCustomerMutation.isPending}
                        title="Convert to customer"
                      >
                        <ArrowRight className="h-4 w-4 rotate-45" />
                        <span className="sr-only">Convert to Customer</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {prospects.length === 0 && (
            <div className="text-center py-10 text-gray-500">
              No prospects found. Add prospects to track potential opportunities.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}