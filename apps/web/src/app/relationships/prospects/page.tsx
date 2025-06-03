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
import { apiEndpoints } from '@/lib/api';
import { Eye, Pencil, Trash2, Plus, ArrowRight } from 'lucide-react';

interface ProspectMetadata {
  source?: string;
  industry?: string;
  annualRevenue?: number;
  numberOfEmployees?: number;
  assignedTo?: string;
}

interface Prospect {
  id: string;
  name: string;
  displayName?: string | null;
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
  const { getToken } = useAuth();
  const router = useRouter();
  const [prospects, setProspects] = useState<Prospect[]>([]);
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
      assignedTo: '',
    }
  });

  useEffect(() => {
    fetchProspects();
  }, []);

  const fetchProspects = async () => {
    try {
      const token = await getToken();
      const response = await fetch(apiEndpoints.prospects, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch prospects');
      
      const data = await response.json();
      setProspects(data.data || []);
    } catch (error) {
      console.error('Error fetching prospects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const token = await getToken();
      const response = await fetch(apiEndpoints.prospects, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          displayName: formData.displayName || undefined,
          entityTypes: ['Prospect'],
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          website: formData.website || undefined,
          status: formData.status,
          isActive: true,
          metadata: {
            source: formData.metadata.source || undefined,
            industry: formData.metadata.industry || undefined,
            annualRevenue: formData.metadata.annualRevenue || undefined,
            numberOfEmployees: formData.metadata.numberOfEmployees || undefined,
            assignedTo: formData.metadata.assignedTo || undefined,
          },
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Create prospect error:', errorData);
        throw new Error(errorData.error || errorData.message || 'Failed to create prospect');
      }
      
      await fetchProspects();
      setIsCreateOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error creating prospect:', error);
      alert(error instanceof Error ? error.message : 'Failed to create prospect');
    }
  };

  const handleConvert = async (prospectId: string, convertTo: 'lead' | 'customer') => {
    const confirmMsg = convertTo === 'lead' 
      ? 'Convert this prospect to a lead?' 
      : 'Convert this prospect directly to a customer?';
      
    if (!confirm(confirmMsg)) return;
    
    try {
      const token = await getToken();
      const endpoint = convertTo === 'lead' 
        ? `${apiEndpoints.prospects}/${prospectId}/convert-to-lead`
        : `${apiEndpoints.prospects}/${prospectId}/convert-to-customer`;
        
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) throw new Error(`Failed to convert prospect to ${convertTo}`);
      
      await fetchProspects();
    } catch (error) {
      console.error('Error converting prospect:', error);
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

  if (loading) return <div>Loading...</div>;

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
                        value={formData.metadata.source}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          metadata: { ...formData.metadata, source: e.target.value }
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
                    <Badge variant={prospect.status === 'active' ? 'default' : 'secondary'}>
                      {prospect.status}
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
                        onClick={() => handleConvert(prospect.id, 'lead')}
                        title="Convert to lead"
                      >
                        <ArrowRight className="h-4 w-4" />
                        <span className="sr-only">Convert to Lead</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleConvert(prospect.id, 'customer')}
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