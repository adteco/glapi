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
import { Slider } from '@/components/ui/slider';
import { Eye, Pencil, Trash2, Plus, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface LeadMetadata {
  source?: string;
  industry?: string;
  annualRevenue?: number;
  numberOfEmployees?: number;
  leadScore?: number;
  assignedTo?: string;
}

interface Lead {
  id: string;
  name: string;
  displayName?: string | null;
  code?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  metadata?: LeadMetadata | null;
  status: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function LeadsPage() {
  const { orgId } = useAuth();
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    email: '',
    phone: '',
    website: '',
    status: 'active',
    metadata: {
      source: '',
      industry: '',
      annualRevenue: 0,
      numberOfEmployees: 0,
      leadScore: 50,
      assignedTo: '',
    }
  });

  // TRPC queries and mutations
  const { data: leadsData, isLoading, refetch } = trpc.leads.list.useQuery({}, {
    enabled: !!orgId,
  });
  
  const createLeadMutation = trpc.leads.create.useMutation({
    onSuccess: () => {
      toast.success('Lead created successfully');
      setIsCreateOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create lead');
    },
  });
  
  const updateLeadMutation = trpc.leads.update.useMutation({
    onSuccess: () => {
      toast.success('Lead updated successfully');
      setIsEditOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update lead');
    },
  });
  
  const deleteLeadMutation = trpc.leads.delete.useMutation({
    onSuccess: () => {
      toast.success('Lead deleted successfully');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete lead');
    },
  });
  
  const convertToCustomerMutation = trpc.leads.convertToCustomer.useMutation({
    onSuccess: () => {
      toast.success('Lead converted to customer successfully');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to convert lead');
    },
  });

  const leads = (leadsData?.data || []).map(lead => ({
    ...lead,
    id: lead.id || '',
    createdAt: lead.createdAt?.toString() || new Date().toISOString(),
    updatedAt: lead.updatedAt?.toString() || new Date().toISOString(),
  }));

  const handleCreate = async () => {
    if (!formData.name) {
      toast.error('Company name is required');
      return;
    }

    createLeadMutation.mutate({
      name: formData.name,
      displayName: formData.displayName || undefined,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      website: formData.website || undefined,
      isActive: true,
      metadata: {
        source: formData.metadata.source || undefined,
        industry: formData.metadata.industry || undefined,
        annualRevenue: formData.metadata.annualRevenue || undefined,
        numberOfEmployees: formData.metadata.numberOfEmployees || undefined,
        leadScore: formData.metadata.leadScore || undefined,
        assignedTo: formData.metadata.assignedTo || undefined,
      },
    });
  };

  const handleUpdate = async () => {
    if (!selectedLead) return;
    
    updateLeadMutation.mutate({
      id: selectedLead.id,
      data: {
        name: formData.name,
        displayName: formData.displayName || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        website: formData.website || undefined,
        isActive: true,
        metadata: {
          source: formData.metadata.source || undefined,
          industry: formData.metadata.industry || undefined,
          annualRevenue: formData.metadata.annualRevenue || undefined,
          numberOfEmployees: formData.metadata.numberOfEmployees || undefined,
          leadScore: formData.metadata.leadScore || undefined,
          assignedTo: formData.metadata.assignedTo || undefined,
        },
      },
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    
    deleteLeadMutation.mutate({ id });
  };

  const handleConvertToCustomer = async (leadId: string) => {
    if (!confirm('Convert this lead to a customer?')) return;
    
    convertToCustomerMutation.mutate({ id: leadId });
  };

  const openEditDialog = (lead: Lead) => {
    setSelectedLead(lead);
    setFormData({
      name: lead.name,
      displayName: lead.displayName || '',
      email: lead.email || '',
      phone: lead.phone || '',
      website: lead.website || '',
      status: lead.status,
      metadata: {
        source: lead.metadata?.source || '',
        industry: lead.metadata?.industry || '',
        annualRevenue: lead.metadata?.annualRevenue || 0,
        numberOfEmployees: lead.metadata?.numberOfEmployees || 0,
        leadScore: lead.metadata?.leadScore || 50,
        assignedTo: lead.metadata?.assignedTo || '',
      }
    });
    setIsEditOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      displayName: '',
      email: '',
      phone: '',
      website: '',
      status: 'active',
      metadata: {
        source: '',
        industry: '',
        annualRevenue: 0,
        numberOfEmployees: 0,
        leadScore: 50,
        assignedTo: '',
      }
    });
    setSelectedLead(null);
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return <div className="container mx-auto py-10"><p>Loading leads...</p></div>;
  }

  if (!orgId) {
    return <div className="container mx-auto py-10"><p>Please select an organization to view leads.</p></div>;
  }

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Leads</CardTitle>
              <CardDescription>Manage and track your sales leads</CardDescription>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Lead
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Lead</DialogTitle>
                  <DialogDescription>Add a new lead to your sales pipeline</DialogDescription>
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
                      <Label htmlFor="source">Lead Source</Label>
                      <Input
                        id="source"
                        value={formData.metadata.source}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          metadata: { ...formData.metadata, source: e.target.value }
                        })}
                        placeholder="e.g., Website, Referral, Trade Show"
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
                      <Label htmlFor="revenue">Annual Revenue</Label>
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
                    <Label htmlFor="leadScore">Lead Score: {formData.metadata.leadScore}</Label>
                    <Slider
                      id="leadScore"
                      min={0}
                      max={100}
                      step={5}
                      value={[formData.metadata.leadScore]}
                      onValueChange={(value) => setFormData({ 
                        ...formData, 
                        metadata: { ...formData.metadata, leadScore: value[0] }
                      })}
                      className="w-full"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={createLeadMutation.isPending}>
                    {createLeadMutation.isPending ? 'Creating...' : 'Create'}
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
                <TableHead>Source</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">
                    {lead.displayName || lead.name}
                  </TableCell>
                  <TableCell>{lead.metadata?.source || '-'}</TableCell>
                  <TableCell>{lead.metadata?.industry || '-'}</TableCell>
                  <TableCell>
                    <span className={`font-semibold ${getScoreColor(lead.metadata?.leadScore || 0)}`}>
                      {lead.metadata?.leadScore || 0}
                    </span>
                  </TableCell>
                  <TableCell>
                    {lead.metadata?.annualRevenue ? formatCurrency(lead.metadata.annualRevenue) : '-'}
                  </TableCell>
                  <TableCell>{lead.email || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={lead.status === 'active' ? 'default' : 'secondary'}>
                      {lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => router.push(`/relationships/leads/${lead.id}`)}
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">View</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => openEditDialog(lead)}
                        title="Edit lead"
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDelete(lead.id)}
                        title="Delete lead"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleConvertToCustomer(lead.id)}
                        title="Convert to customer"
                      >
                        <ArrowRight className="h-4 w-4" />
                        <span className="sr-only">Convert</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {leads.length === 0 && (
            <div className="text-center py-10 text-gray-500">
              No leads found. Add your first lead to start building your pipeline.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
            <DialogDescription>Update lead information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Company Name*</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-source">Lead Source</Label>
                <Input
                  id="edit-source"
                  value={formData.metadata.source}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    metadata: { ...formData.metadata, source: e.target.value }
                  })}
                  placeholder="e.g., Website, Referral, Trade Show"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-website">Website</Label>
                <Input
                  id="edit-website"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-industry">Industry</Label>
                <Input
                  id="edit-industry"
                  value={formData.metadata.industry}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    metadata: { ...formData.metadata, industry: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-revenue">Annual Revenue</Label>
                <Input
                  id="edit-revenue"
                  type="number"
                  value={formData.metadata.annualRevenue}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    metadata: { ...formData.metadata, annualRevenue: Number(e.target.value) }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-employees">Number of Employees</Label>
                <Input
                  id="edit-employees"
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
              <Label htmlFor="edit-leadScore">Lead Score: {formData.metadata.leadScore}</Label>
              <Slider
                id="edit-leadScore"
                min={0}
                max={100}
                step={5}
                value={[formData.metadata.leadScore]}
                onValueChange={(value) => setFormData({ 
                  ...formData, 
                  metadata: { ...formData.metadata, leadScore: value[0] }
                })}
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateLeadMutation.isPending}>
              {updateLeadMutation.isPending ? 'Updating...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}