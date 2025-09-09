"use client";

import { useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/trpc';
import { formatCurrency, formatPercentage } from '@/lib/utils';
import { Plus, Edit, Trash, AlertTriangle, CheckCircle, Brain, TrendingUp } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface SSPFormData {
  itemId: string;
  method: 'vsoe' | 'statistical' | 'ml' | 'manual';
  sspAmount: number;
  confidence: number;
  notes?: string;
  startDate: string;
  endDate: string;
}

export function SSPManager() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedSSP, setSelectedSSP] = useState<any>(null);
  const [formData, setFormData] = useState<SSPFormData>({
    itemId: '',
    method: 'vsoe',
    sspAmount: 0,
    confidence: 0.8,
    notes: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const { toast } = useToast();

  // Fetch SSP data
  const { data: sspDashboard } = api.sspAnalytics.getDashboard.useQuery();
  const { data: sspItems } = api.sspAnalytics.listCalculationRuns.useQuery({
    limit: 50,
    offset: 0
  });

  // Mutations
  const startCalculationRun = api.sspAnalytics.startCalculationRun.useMutation({
    onSuccess: () => {
      toast({
        title: "SSP Calculation Started",
        description: "The SSP calculation run has been initiated successfully."
      });
      setIsAddDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Calculation Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const trainMLModel = api.sspAnalytics.trainMLModel.useMutation({
    onSuccess: (result) => {
      toast({
        title: "ML Model Trained",
        description: `Model trained with ${(result.data.accuracy * 100).toFixed(1)}% accuracy`
      });
    }
  });

  const handleRunCalculation = async () => {
    await startCalculationRun.mutateAsync({
      startDate: formData.startDate,
      endDate: formData.endDate,
      calculationMethod: formData.method,
      minTransactions: 5,
      confidenceThreshold: formData.confidence,
      runType: 'manual'
    });
  };

  const handleTrainModel = async () => {
    await trainMLModel.mutateAsync({
      startDate: formData.startDate,
      endDate: formData.endDate
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">SSP Management</h2>
          <p className="text-muted-foreground">Standalone Selling Price evidence and analysis</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTrainModel}>
            <Brain className="h-4 w-4 mr-2" />
            Train ML Model
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Run SSP Calculation
          </Button>
        </div>
      </div>

      {/* SSP Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Items with SSP</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sspDashboard?.summary.totalItems || 0}
            </div>
            <div className="flex items-center mt-2">
              <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-sm text-green-500">
                {sspDashboard?.summary.itemsWithSSP || 0} active
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Items Needing Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sspDashboard?.summary.itemsNeedingReview || 0}
            </div>
            <div className="flex items-center mt-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mr-1" />
              <span className="text-sm text-yellow-500">
                Requires attention
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Average Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercentage(sspDashboard?.summary.averageConfidence || 0)}
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              Across all SSP evidence
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Method Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>VSOE:</span>
                <span className="font-medium">{sspDashboard?.methodBreakdown.vsoe || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Statistical:</span>
                <span className="font-medium">{sspDashboard?.methodBreakdown.statistical || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>ML:</span>
                <span className="font-medium">{sspDashboard?.methodBreakdown.ml || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Calculation Runs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent SSP Calculation Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Items Processed</TableHead>
                <TableHead>Exceptions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sspDashboard?.recentRuns.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="font-medium">
                    {run.runNumber}
                  </TableCell>
                  <TableCell>
                    {new Date(run.runDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {run.calculationMethod}
                    </Badge>
                  </TableCell>
                  <TableCell>{run.itemsProcessed}</TableCell>
                  <TableCell>
                    {run.itemsWithExceptions > 0 ? (
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        <span>{run.itemsWithExceptions}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>0</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      run.status === 'completed' ? 'success' :
                      run.status === 'failed' ? 'destructive' :
                      run.status === 'running' ? 'default' : 'secondary'
                    }>
                      {run.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        View Details
                      </Button>
                      {run.status === 'completed' && !run.approvedBy && (
                        <Button variant="outline" size="sm">
                          Approve
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Top Exceptions */}
      {sspDashboard?.topExceptions && sspDashboard.topExceptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Items Requiring Attention</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sspDashboard.topExceptions.map((exception) => (
                <div key={exception.itemId} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className={`h-5 w-5 ${
                      exception.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'
                    }`} />
                    <div>
                      <div className="font-medium">{exception.itemName}</div>
                      <div className="text-sm text-muted-foreground">
                        {exception.exceptionCount} exception{exception.exceptionCount > 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      exception.severity === 'critical' ? 'destructive' : 'secondary'
                    }>
                      {exception.severity}
                    </Badge>
                    <Button variant="outline" size="sm">
                      Review
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trends Chart */}
      {sspDashboard?.trends && sspDashboard.trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>SSP Calculation Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <TrendingUp className="h-8 w-8 mr-2" />
              Chart implementation would go here
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add SSP Calculation Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Run SSP Calculation</DialogTitle>
            <DialogDescription>
              Configure and run a new SSP calculation for your items
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="method">Calculation Method</Label>
              <Select
                value={formData.method}
                onValueChange={(value) => setFormData({ ...formData, method: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vsoe">VSOE (Vendor-Specific Objective Evidence)</SelectItem>
                  <SelectItem value="statistical">Statistical Analysis</SelectItem>
                  <SelectItem value="ml">Machine Learning</SelectItem>
                  <SelectItem value="hybrid">Hybrid (All Methods)</SelectItem>
                  <SelectItem value="manual">Manual Override</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confidence">Minimum Confidence Threshold</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="confidence"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={formData.confidence}
                  onChange={(e) => setFormData({ ...formData, confidence: parseFloat(e.target.value) })}
                  className="flex-1"
                />
                <span className="w-12 text-sm font-medium">
                  {formatPercentage(formData.confidence)}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this calculation run..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRunCalculation} disabled={startCalculationRun.isLoading}>
              {startCalculationRun.isLoading ? 'Running...' : 'Run Calculation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}