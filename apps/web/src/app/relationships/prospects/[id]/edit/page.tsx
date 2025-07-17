'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/lib/trpc';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function EditProspectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const { data: prospect, isLoading } = trpc.prospects.getById.useQuery({ id });

  const updateMutation = trpc.prospects.update.useMutation({
    onSuccess: () => {
      toast.success('Prospect updated successfully');
      router.push(`/relationships/prospects/${id}`);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update prospect');
    },
  });

  const [formData, setFormData] = useState({
    name: '',
    legalName: '',
    entityId: '',
    email: '',
    phone: '',
    website: '',
    notes: '',
    taxIdNumber: '',
    isActive: true,
    metadata: {
      prospect_source: '',
      prospect_status: '',
      qualification_score: 0,
      next_action: '',
      follow_up_date: '',
      industry: '',
      annualRevenue: 0,
      numberOfEmployees: 0,
      assignedTo: '',
    }
  });

  useEffect(() => {
    if (prospect) {
      setFormData({
        name: prospect.name || '',
        legalName: prospect.legalName || '',
        entityId: prospect.entityId || '',
        email: prospect.email || '',
        phone: prospect.phone || '',
        website: prospect.website || '',
        notes: prospect.notes || '',
        taxIdNumber: prospect.taxIdNumber || '',
        isActive: prospect.isActive ?? true,
        metadata: {
          prospect_source: prospect.metadata?.prospect_source || '',
          prospect_status: prospect.metadata?.prospect_status || '',
          qualification_score: prospect.metadata?.qualification_score || 0,
          next_action: prospect.metadata?.next_action || '',
          follow_up_date: prospect.metadata?.follow_up_date || '',
          industry: prospect.metadata?.industry || '',
          annualRevenue: prospect.metadata?.annualRevenue || 0,
          numberOfEmployees: prospect.metadata?.numberOfEmployees || 0,
          assignedTo: prospect.metadata?.assignedTo || '',
        }
      });
    }
  }, [prospect]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast.error('Company name is required');
      return;
    }

    updateMutation.mutate({
      id,
      data: {
        name: formData.name,
        legalName: formData.legalName || undefined,
        entityId: formData.entityId || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        website: formData.website || undefined,
        notes: formData.notes || undefined,
        taxIdNumber: formData.taxIdNumber || undefined,
        isActive: formData.isActive,
        metadata: {
          prospect_source: formData.metadata.prospect_source || undefined,
          prospect_status: formData.metadata.prospect_status || undefined,
          qualification_score: formData.metadata.qualification_score || undefined,
          next_action: formData.metadata.next_action || undefined,
          follow_up_date: formData.metadata.follow_up_date || undefined,
          industry: formData.metadata.industry || undefined,
          annualRevenue: formData.metadata.annualRevenue || undefined,
          numberOfEmployees: formData.metadata.numberOfEmployees || undefined,
          assignedTo: formData.metadata.assignedTo || undefined,
        },
      },
    });
  };

  if (isLoading) return <div>Loading...</div>;
  if (!prospect) return <div>Prospect not found</div>;

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push(`/relationships/prospects/${id}`)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Prospect
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Edit Prospect</CardTitle>
            <CardDescription>Update prospect information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
                <Label htmlFor="legalName">Legal Name</Label>
                <Input
                  id="legalName"
                  value={formData.legalName}
                  onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entityId">Entity ID</Label>
                <Input
                  id="entityId"
                  value={formData.entityId}
                  onChange={(e) => setFormData({ ...formData, entityId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxIdNumber">Tax ID Number</Label>
                <Input
                  id="taxIdNumber"
                  value={formData.taxIdNumber}
                  onChange={(e) => setFormData({ ...formData, taxIdNumber: e.target.value })}
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
                <Label htmlFor="status">Status</Label>
                <Input
                  id="status"
                  value={formData.metadata.prospect_status}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    metadata: { ...formData.metadata, prospect_status: e.target.value }
                  })}
                  placeholder="e.g., New, Contacted, Qualified"
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
              <div className="space-y-2">
                <Label htmlFor="score">Qualification Score (0-100)</Label>
                <Input
                  id="score"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.metadata.qualification_score}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    metadata: { ...formData.metadata, qualification_score: Number(e.target.value) }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignedTo">Assigned To</Label>
                <Input
                  id="assignedTo"
                  value={formData.metadata.assignedTo}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    metadata: { ...formData.metadata, assignedTo: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="followUpDate">Follow-up Date</Label>
                <Input
                  id="followUpDate"
                  type="date"
                  value={formData.metadata.follow_up_date}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    metadata: { ...formData.metadata, follow_up_date: e.target.value }
                  })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nextAction">Next Action</Label>
              <Input
                id="nextAction"
                value={formData.metadata.next_action}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  metadata: { ...formData.metadata, next_action: e.target.value }
                })}
                placeholder="e.g., Schedule demo, Send proposal"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about this prospect"
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/relationships/prospects/${id}`)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}