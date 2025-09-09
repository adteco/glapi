"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/trpc';
import { formatCurrency } from '@/lib/utils';
import { 
  ChevronRight, 
  ChevronLeft, 
  AlertCircle,
  CheckCircle,
  Calculator,
  Plus,
  Minus,
  Edit,
  Calendar,
  XCircle
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface ModificationStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<any>;
}

interface ModificationData {
  modificationType: string | null;
  changes: {
    items?: Array<{ itemId: string; action: 'add' | 'remove' | 'modify'; quantity?: number; price?: number }>;
    termExtension?: number;
    earlyTerminationDate?: string;
    priceAdjustment?: { type: 'percentage' | 'fixed'; value: number };
  };
  effectiveDate: string;
  adjustmentMethod: 'prospective' | 'cumulative_catch_up';
  reason?: string;
}

export function ContractModificationWizard({ 
  subscriptionId 
}: { 
  subscriptionId: string 
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [modificationData, setModificationData] = useState<ModificationData>({
    modificationType: null,
    changes: {},
    effectiveDate: new Date().toISOString().split('T')[0],
    adjustmentMethod: 'prospective'
  });
  const { toast } = useToast();

  const steps: ModificationStep[] = [
    {
      id: 'type',
      title: 'Modification Type',
      description: 'Select the type of contract modification',
      component: ModificationTypeSelector
    },
    {
      id: 'changes',
      title: 'Specify Changes',
      description: 'Define what is changing in the contract',
      component: ChangeSpecification
    },
    {
      id: 'impact',
      title: 'Impact Analysis',
      description: 'Review the revenue recognition impact',
      component: ImpactAnalysis
    },
    {
      id: 'accounting',
      title: 'Accounting Treatment',
      description: 'Choose prospective or cumulative catch-up',
      component: AccountingTreatment
    },
    {
      id: 'review',
      title: 'Review & Approve',
      description: 'Review all changes before applying',
      component: ReviewAndApprove
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    try {
      await api.subscriptions.modifyContract.mutate({
        subscriptionId,
        ...modificationData
      });
      
      toast({
        title: "Contract Modified Successfully",
        description: "The contract modification has been applied and revenue schedules updated."
      });
    } catch (error) {
      toast({
        title: "Modification Failed",
        description: "Failed to apply contract modification. Please try again.",
        variant: "destructive"
      });
    }
  };

  const CurrentStepComponent = steps[currentStep].component;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress Indicator */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Step {currentStep + 1} of {steps.length}</span>
          <span>{steps[currentStep].title}</span>
        </div>
        <Progress value={(currentStep + 1) / steps.length * 100} />
      </div>

      {/* Step Indicators */}
      <div className="flex justify-between">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`flex items-center ${index !== steps.length - 1 ? 'flex-1' : ''}`}
          >
            <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
              index < currentStep ? 'bg-primary border-primary text-primary-foreground' :
              index === currentStep ? 'border-primary text-primary' :
              'border-muted-foreground text-muted-foreground'
            }`}>
              {index < currentStep ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <span className="text-sm font-medium">{index + 1}</span>
              )}
            </div>
            {index !== steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${
                index < currentStep ? 'bg-primary' : 'bg-muted'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{steps[currentStep].title}</CardTitle>
          <CardDescription>{steps[currentStep].description}</CardDescription>
        </CardHeader>
        <CardContent>
          <CurrentStepComponent 
            data={modificationData}
            onChange={(updates: Partial<ModificationData>) => setModificationData({
              ...modificationData,
              ...updates
            })}
            subscriptionId={subscriptionId}
          />
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={handlePrevious}
          disabled={currentStep === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        
        {currentStep === steps.length - 1 ? (
          <Button onClick={handleComplete}>
            Complete Modification
            <CheckCircle className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleNext}>
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Step Components
function ModificationTypeSelector({ data, onChange }: any) {
  const types = [
    {
      id: 'add_items',
      title: 'Add Items',
      description: 'Add new products or services to the contract',
      icon: Plus
    },
    {
      id: 'remove_items',
      title: 'Remove Items',
      description: 'Remove products or services from the contract',
      icon: Minus
    },
    {
      id: 'change_quantity',
      title: 'Change Quantity',
      description: 'Modify quantities of existing items',
      icon: Edit
    },
    {
      id: 'change_price',
      title: 'Change Price',
      description: 'Update pricing for existing items',
      icon: Calculator
    },
    {
      id: 'extend_term',
      title: 'Extend Term',
      description: 'Extend the contract end date',
      icon: Calendar
    },
    {
      id: 'early_termination',
      title: 'Early Termination',
      description: 'Terminate the contract before end date',
      icon: XCircle
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {types.map((type) => {
        const Icon = type.icon;
        return (
          <Card 
            key={type.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              data.modificationType === type.id ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => onChange({ modificationType: type.id })}
          >
            <CardHeader>
              <div className="flex items-start gap-3">
                <Icon className="h-5 w-5 mt-1 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">{type.title}</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    {type.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        );
      })}
    </div>
  );
}

function ChangeSpecification({ data, onChange }: any) {
  const renderChangeForm = () => {
    switch (data.modificationType) {
      case 'add_items':
        return <AddItemsForm data={data} onChange={onChange} />;
      case 'remove_items':
        return <RemoveItemsForm data={data} onChange={onChange} />;
      case 'change_quantity':
        return <ChangeQuantityForm data={data} onChange={onChange} />;
      case 'change_price':
        return <ChangePriceForm data={data} onChange={onChange} />;
      case 'extend_term':
        return <ExtendTermForm data={data} onChange={onChange} />;
      case 'early_termination':
        return <EarlyTerminationForm data={data} onChange={onChange} />;
      default:
        return <div>Please select a modification type first</div>;
    }
  };

  return (
    <div className="space-y-4">
      {renderChangeForm()}
      
      <div className="space-y-2">
        <Label htmlFor="effectiveDate">Effective Date</Label>
        <Input
          id="effectiveDate"
          type="date"
          value={data.effectiveDate}
          onChange={(e) => onChange({ effectiveDate: e.target.value })}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="reason">Reason for Modification</Label>
        <Textarea
          id="reason"
          placeholder="Describe the reason for this contract modification..."
          value={data.reason || ''}
          onChange={(e) => onChange({ reason: e.target.value })}
        />
      </div>
    </div>
  );
}

function ImpactAnalysis({ data, subscriptionId }: any) {
  // Mock impact data - would be fetched from API
  const impact = {
    currentValue: 120000,
    modifiedValue: 150000,
    affectedObligations: [
      { id: '1', itemName: 'Software License', currentAmount: 50000, newAmount: 60000, change: 10000 },
      { id: '2', itemName: 'Support Services', currentAmount: 30000, newAmount: 35000, change: 5000 },
      { id: '3', itemName: 'Training', currentAmount: 10000, newAmount: 15000, change: 5000 }
    ],
    revenueImpact: {
      currentPeriod: 5000,
      futurePeriods: 25000,
      totalImpact: 30000
    }
  };

  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          This modification will affect revenue recognition schedules and may require journal entry adjustments.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Current Contract Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(impact.currentValue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Modified Contract Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(impact.modifiedValue)}
            </div>
            <div className="text-sm text-muted-foreground">
              Change: {formatCurrency(impact.modifiedValue - impact.currentValue)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Affected Performance Obligations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Affected Performance Obligations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {impact.affectedObligations.map((obligation) => (
              <div key={obligation.id} className="flex justify-between items-center p-3 border rounded">
                <span className="font-medium">{obligation.itemName}</span>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">
                    {formatCurrency(obligation.currentAmount)} → {formatCurrency(obligation.newAmount)}
                  </div>
                  <Badge variant={obligation.change > 0 ? 'default' : 'destructive'}>
                    {obligation.change > 0 ? '+' : ''}{formatCurrency(obligation.change)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Revenue Impact */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue Recognition Impact</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Current Period Impact:</span>
              <span className="font-medium">{formatCurrency(impact.revenueImpact.currentPeriod)}</span>
            </div>
            <div className="flex justify-between">
              <span>Future Periods Impact:</span>
              <span className="font-medium">{formatCurrency(impact.revenueImpact.futurePeriods)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="font-medium">Total Impact:</span>
              <span className="font-bold">{formatCurrency(impact.revenueImpact.totalImpact)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AccountingTreatment({ data, onChange }: any) {
  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          ASC 606 requires you to choose the appropriate accounting treatment for this contract modification.
        </AlertDescription>
      </Alert>

      <RadioGroup
        value={data.adjustmentMethod}
        onValueChange={(value) => onChange({ adjustmentMethod: value })}
      >
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <RadioGroupItem value="prospective" id="prospective" />
              <Label htmlFor="prospective" className="cursor-pointer">
                <div>
                  <div className="font-medium">Prospective Method</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Account for the modification as if it were a separate contract. 
                    Revenue adjustments apply only to future periods.
                  </div>
                </div>
              </Label>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <RadioGroupItem value="cumulative_catch_up" id="cumulative" />
              <Label htmlFor="cumulative" className="cursor-pointer">
                <div>
                  <div className="font-medium">Cumulative Catch-up Method</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Adjust revenue to reflect the modification as if it had been in place 
                    from contract inception. May result in current period adjustments.
                  </div>
                </div>
              </Label>
            </div>
          </CardHeader>
        </Card>
      </RadioGroup>

      {data.adjustmentMethod === 'cumulative_catch_up' && (
        <Alert>
          <Calculator className="h-4 w-4" />
          <AlertDescription>
            <strong>Cumulative Adjustment Required:</strong> This method will result in a 
            one-time adjustment of approximately {formatCurrency(15000)} in the current period.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function ReviewAndApprove({ data, subscriptionId }: any) {
  return (
    <div className="space-y-6">
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          Please review all modification details before submitting for approval.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Modification Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type:</span>
              <span className="font-medium">{data.modificationType?.replace(/_/g, ' ').toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Effective Date:</span>
              <span className="font-medium">{data.effectiveDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Accounting Method:</span>
              <span className="font-medium">
                {data.adjustmentMethod === 'prospective' ? 'Prospective' : 'Cumulative Catch-up'}
              </span>
            </div>
            {data.reason && (
              <div>
                <span className="text-muted-foreground">Reason:</span>
                <p className="mt-1 text-sm">{data.reason}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approval Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Finance Manager approval required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Revenue recognition impact assessed</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Customer notification prepared</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Helper form components for different modification types
function AddItemsForm({ data, onChange }: any) {
  return (
    <div className="space-y-4">
      <Label>Items to Add</Label>
      <div className="space-y-2">
        <div className="p-3 border rounded-lg">
          <Input placeholder="Item name" className="mb-2" />
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" placeholder="Quantity" />
            <Input type="number" placeholder="Price" />
          </div>
        </div>
      </div>
      <Button variant="outline" size="sm">
        <Plus className="h-4 w-4 mr-2" />
        Add Another Item
      </Button>
    </div>
  );
}

function RemoveItemsForm({ data, onChange }: any) {
  return (
    <div className="space-y-4">
      <Label>Select Items to Remove</Label>
      <div className="space-y-2">
        {/* Mock items - would be fetched from API */}
        {['Software License', 'Support Services', 'Training'].map((item) => (
          <div key={item} className="flex items-center space-x-2">
            <input type="checkbox" id={item} />
            <Label htmlFor={item}>{item}</Label>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChangeQuantityForm({ data, onChange }: any) {
  return (
    <div className="space-y-4">
      <Label>Modify Item Quantities</Label>
      <div className="space-y-2">
        {/* Mock items - would be fetched from API */}
        {['Software License', 'Support Services'].map((item) => (
          <div key={item} className="flex items-center justify-between p-3 border rounded-lg">
            <span>{item}</span>
            <Input type="number" placeholder="New quantity" className="w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ChangePriceForm({ data, onChange }: any) {
  return (
    <div className="space-y-4">
      <Label>Price Adjustment</Label>
      <RadioGroup defaultValue="percentage">
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="percentage" id="percentage" />
          <Label htmlFor="percentage">Percentage Change</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="fixed" id="fixed" />
          <Label htmlFor="fixed">Fixed Amount</Label>
        </div>
      </RadioGroup>
      <Input type="number" placeholder="Enter adjustment value" />
    </div>
  );
}

function ExtendTermForm({ data, onChange }: any) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="extensionMonths">Extension Period (months)</Label>
        <Input
          id="extensionMonths"
          type="number"
          placeholder="Number of months to extend"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newEndDate">New End Date</Label>
        <Input
          id="newEndDate"
          type="date"
        />
      </div>
    </div>
  );
}

function EarlyTerminationForm({ data, onChange }: any) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="terminationDate">Termination Date</Label>
        <Input
          id="terminationDate"
          type="date"
        />
      </div>
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Early termination may trigger penalties or require pro-rated refunds.
        </AlertDescription>
      </Alert>
    </div>
  );
}