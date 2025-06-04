'use client';

import { useState, useEffect } from 'react';
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
import { Slider } from '@/components/ui/slider';
import { apiEndpoints } from '@/lib/api';
import { Eye, Pencil, Trash2, Plus, ArrowRight } from 'lucide-react';

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
  const { getToken } = useAuth();
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
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

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const token = await getToken();
      const response = await fetch(apiEndpoints.leads, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch leads');
      
      const data = await response.json();
      setLeads(data.data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const token = await getToken();
      const response = await fetch(apiEndpoints.leads, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          displayName: formData.displayName || undefined,
          entityTypes: ['Lead'],
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          website: formData.website || undefined,
          status: formData.status,
          isActive: true,
          metadata: {
            source: formData.metadata.source || undefined,
            industry: formData.metadata.industry || undefined,
            leadScore: formData.metadata.leadScore || undefined,
          },
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Create lead error:', errorData);
        throw new Error(errorData.error || errorData.message || 'Failed to create lead');
      }
      
      await fetchLeads();
      setIsCreateOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error creating lead:', error);
      alert(error instanceof Error ? error.message : 'Failed to create lead');
    }
  };

  const handleConvertToCustomer = async (leadId: string) => {
    if (!confirm('Convert this lead to a customer?')) return;
    
    try {
      const token = await getToken();
      const response = await fetch(`${apiEndpoints.leads}/${leadId}/convert-to-customer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to convert lead');
      
      await fetchLeads();
    } catch (error) {
      console.error('Error converting lead:', error);
    }
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

  if (loading) return <div>Loading...</div>;

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
                  <Button onClick={handleCreate}>Create</Button>
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
    </div>
  );
}