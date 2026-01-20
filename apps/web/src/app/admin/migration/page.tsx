'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/lib/trpc';

// =============================================================================
// Types
// =============================================================================

type WizardStep = 'source' | 'upload' | 'mapping' | 'validation' | 'import' | 'complete';

interface SourceSystem {
  id: string;
  name: string;
  icon: string;
}

interface DataType {
  id: string;
  name: string;
  category: 'master' | 'transaction';
}

interface FieldMapping {
  sourceField: string;
  targetField: string;
  defaultValue?: string;
  transformation?: string;
}

// =============================================================================
// Step Indicator Component
// =============================================================================

function StepIndicator({
  steps,
  currentStep,
}: {
  steps: { id: WizardStep; label: string }[];
  currentStep: WizardStep;
}) {
  const currentIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((step, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  isComplete
                    ? 'bg-green-500 text-white'
                    : isCurrent
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isComplete ? '✓' : index + 1}
              </div>
              <span
                className={`mt-2 text-xs ${
                  isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-16 h-0.5 mx-2 ${
                  isComplete ? 'bg-green-500' : 'bg-muted'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// Progress Bar Component
// =============================================================================

function ProgressBar({ value, max = 100 }: { value: number; max?: number }) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className="w-full bg-muted rounded-full h-2.5">
      <div
        className="bg-primary h-2.5 rounded-full transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

// =============================================================================
// Source Selection Step
// =============================================================================

function SourceSelectionStep({
  onNext,
  sourceSystem,
  setSourceSystem,
  selectedDataTypes,
  setSelectedDataTypes,
}: {
  onNext: () => void;
  sourceSystem: string;
  setSourceSystem: (value: string) => void;
  selectedDataTypes: string[];
  setSelectedDataTypes: (value: string[]) => void;
}) {
  const { data: systems } = trpc.imports.getSupportedSystems.useQuery();
  const { data: dataTypes } = trpc.imports.getSupportedDataTypes.useQuery();

  const masterDataTypes = dataTypes?.filter(dt => dt.category === 'master') ?? [];
  const transactionDataTypes = dataTypes?.filter(dt => dt.category === 'transaction') ?? [];

  const toggleDataType = (id: string) => {
    setSelectedDataTypes(
      selectedDataTypes.includes(id)
        ? selectedDataTypes.filter(t => t !== id)
        : [...selectedDataTypes, id]
    );
  };

  const canProceed = sourceSystem && selectedDataTypes.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Select Source System</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {systems?.map(system => (
            <button
              key={system.id}
              onClick={() => setSourceSystem(system.id)}
              className={`p-4 border rounded-lg text-center transition-colors hover:border-primary ${
                sourceSystem === system.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border'
              }`}
            >
              <div className="text-2xl mb-2">
                {system.icon === 'csv' ? '📄' : system.icon === 'excel' ? '📊' : '🔗'}
              </div>
              <div className="text-sm font-medium">{system.name}</div>
            </button>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-lg font-medium mb-4">Select Data Types to Import</h3>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Master Data</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {masterDataTypes.map(dt => (
                <label
                  key={dt.id}
                  className={`flex items-center space-x-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedDataTypes.includes(dt.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Checkbox
                    checked={selectedDataTypes.includes(dt.id)}
                    onCheckedChange={() => toggleDataType(dt.id)}
                  />
                  <span className="text-sm">{dt.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Transactions</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {transactionDataTypes.map(dt => (
                <label
                  key={dt.id}
                  className={`flex items-center space-x-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedDataTypes.includes(dt.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Checkbox
                    checked={selectedDataTypes.includes(dt.id)}
                    onCheckedChange={() => toggleDataType(dt.id)}
                  />
                  <span className="text-sm">{dt.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!canProceed}>
          Continue
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Upload Step
// =============================================================================

function UploadStep({
  onNext,
  onBack,
  batchName,
  setBatchName,
  batchDescription,
  setBatchDescription,
  uploadedFile,
  setUploadedFile,
  parsedRecords,
  setParsedRecords,
  sourceSystem,
}: {
  onNext: () => void;
  onBack: () => void;
  batchName: string;
  setBatchName: (value: string) => void;
  batchDescription: string;
  setBatchDescription: (value: string) => void;
  uploadedFile: File | null;
  setUploadedFile: (file: File | null) => void;
  parsedRecords: Record<string, unknown>[];
  setParsedRecords: (records: Record<string, unknown>[]) => void;
  sourceSystem: string;
}) {
  const [isParsingFile, setIsParsingFile] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setIsParsingFile(true);

    try {
      // Parse CSV/Excel file
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        toast.error('File must have at least a header row and one data row');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
      const records: Record<string, unknown>[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
        const record: Record<string, unknown> = {};

        headers.forEach((header, index) => {
          record[header] = values[index] ?? '';
        });

        records.push(record);
      }

      setParsedRecords(records);
      toast.success(`Parsed ${records.length} records from file`);
    } catch (error) {
      toast.error('Failed to parse file');
    } finally {
      setIsParsingFile(false);
    }
  };

  const canProceed = batchName && parsedRecords.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="batchName">Import Name</Label>
          <Input
            id="batchName"
            value={batchName}
            onChange={e => setBatchName(e.target.value)}
            placeholder="e.g., Q1 2024 Migration"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="batchDescription">Description (optional)</Label>
          <Input
            id="batchDescription"
            value={batchDescription}
            onChange={e => setBatchDescription(e.target.value)}
            placeholder="Brief description of this import"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Upload Data File</Label>
        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          {uploadedFile ? (
            <div>
              <div className="text-2xl mb-2">📄</div>
              <div className="font-medium">{uploadedFile.name}</div>
              <div className="text-sm text-muted-foreground">
                {parsedRecords.length} records parsed
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setUploadedFile(null);
                  setParsedRecords([]);
                }}
              >
                Remove
              </Button>
            </div>
          ) : (
            <div>
              <div className="text-4xl mb-4">📁</div>
              <div className="text-muted-foreground mb-4">
                Drag and drop your CSV or Excel file here, or click to browse
              </div>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="max-w-xs mx-auto"
                disabled={isParsingFile}
              />
            </div>
          )}
        </div>
      </div>

      {parsedRecords.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium">Preview (first 5 rows)</h4>
          <div className="overflow-x-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  {Object.keys(parsedRecords[0]).slice(0, 6).map(key => (
                    <TableHead key={key} className="text-xs">
                      {key}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedRecords.slice(0, 5).map((record, index) => (
                  <TableRow key={index}>
                    {Object.values(record).slice(0, 6).map((value, i) => (
                      <TableCell key={i} className="text-xs">
                        {String(value).substring(0, 30)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!canProceed}>
          Continue
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Field Mapping Step
// =============================================================================

function FieldMappingStep({
  onNext,
  onBack,
  parsedRecords,
  selectedDataTypes,
  fieldMappings,
  setFieldMappings,
}: {
  onNext: () => void;
  onBack: () => void;
  parsedRecords: Record<string, unknown>[];
  selectedDataTypes: string[];
  fieldMappings: FieldMapping[];
  setFieldMappings: (mappings: FieldMapping[]) => void;
}) {
  const sourceFields = parsedRecords.length > 0 ? Object.keys(parsedRecords[0]) : [];

  const targetFieldsByType: Record<string, string[]> = {
    account: ['accountNumber', 'name', 'accountType', 'normalBalance', 'description', 'isActive'],
    customer: ['customerNumber', 'name', 'email', 'phone', 'address1', 'city', 'state', 'postalCode'],
    vendor: ['vendorNumber', 'name', 'email', 'phone', 'address1', 'city', 'state', 'postalCode'],
    item: ['itemNumber', 'name', 'itemType', 'unitPrice', 'cost', 'description', 'isActive'],
    journal_entry: ['entryNumber', 'date', 'memo', 'debitAccount', 'creditAccount', 'amount'],
    opening_balance: ['accountNumber', 'date', 'debitAmount', 'creditAmount'],
  };

  const targetFields = selectedDataTypes.flatMap(dt => targetFieldsByType[dt] ?? []);

  const updateMapping = (index: number, field: keyof FieldMapping, value: string) => {
    const newMappings = [...fieldMappings];
    newMappings[index] = { ...newMappings[index], [field]: value };
    setFieldMappings(newMappings);
  };

  const addMapping = () => {
    setFieldMappings([...fieldMappings, { sourceField: '', targetField: '' }]);
  };

  const removeMapping = (index: number) => {
    setFieldMappings(fieldMappings.filter((_, i) => i !== index));
  };

  const autoMap = () => {
    const newMappings: FieldMapping[] = [];

    for (const targetField of targetFields) {
      const matchingSource = sourceFields.find(
        sf =>
          sf.toLowerCase() === targetField.toLowerCase() ||
          sf.toLowerCase().replace(/[_\s]/g, '') === targetField.toLowerCase()
      );

      if (matchingSource) {
        newMappings.push({ sourceField: matchingSource, targetField });
      }
    }

    setFieldMappings(newMappings);
    toast.success(`Auto-mapped ${newMappings.length} fields`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Map Fields</h3>
          <p className="text-sm text-muted-foreground">
            Map your source columns to GLAPI fields
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={autoMap}>
          Auto-Map Fields
        </Button>
      </div>

      <div className="space-y-4">
        {fieldMappings.map((mapping, index) => (
          <div key={index} className="flex items-center gap-4">
            <Select
              value={mapping.sourceField}
              onValueChange={value => updateMapping(index, 'sourceField', value)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Source field" />
              </SelectTrigger>
              <SelectContent>
                {sourceFields.map(field => (
                  <SelectItem key={field} value={field}>
                    {field}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-muted-foreground">→</span>

            <Select
              value={mapping.targetField}
              onValueChange={value => updateMapping(index, 'targetField', value)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Target field" />
              </SelectTrigger>
              <SelectContent>
                {targetFields.map(field => (
                  <SelectItem key={field} value={field}>
                    {field}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Default value"
              value={mapping.defaultValue ?? ''}
              onChange={e => updateMapping(index, 'defaultValue', e.target.value)}
              className="w-32"
            />

            <Select
              value={mapping.transformation ?? ''}
              onValueChange={value => updateMapping(index, 'transformation', value)}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Transform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                <SelectItem value="uppercase">UPPERCASE</SelectItem>
                <SelectItem value="lowercase">lowercase</SelectItem>
                <SelectItem value="trim">Trim</SelectItem>
                <SelectItem value="boolean">Boolean</SelectItem>
                <SelectItem value="number">Number</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeMapping(index)}
            >
              ✕
            </Button>
          </div>
        ))}

        <Button variant="outline" size="sm" onClick={addMapping}>
          + Add Mapping
        </Button>
      </div>

      {fieldMappings.length > 0 && parsedRecords.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium">Mapped Data Preview</h4>
          <div className="overflow-x-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  {fieldMappings.map(m => (
                    <TableHead key={m.targetField} className="text-xs">
                      {m.targetField}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedRecords.slice(0, 3).map((record, index) => (
                  <TableRow key={index}>
                    {fieldMappings.map(m => (
                      <TableCell key={m.targetField} className="text-xs">
                        {String(record[m.sourceField] ?? m.defaultValue ?? '')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={fieldMappings.length === 0}>
          Continue to Validation
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Validation Step
// =============================================================================

function ValidationStep({
  onNext,
  onBack,
  batchId,
  setBatchId,
  batchName,
  batchDescription,
  sourceSystem,
  selectedDataTypes,
  parsedRecords,
  fieldMappings,
}: {
  onNext: () => void;
  onBack: () => void;
  batchId: string | null;
  setBatchId: (id: string) => void;
  batchName: string;
  batchDescription: string;
  sourceSystem: string;
  selectedDataTypes: string[];
  parsedRecords: Record<string, unknown>[];
  fieldMappings: FieldMapping[];
}) {
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    validRecords: number;
    invalidRecords: number;
    errors: { rowNumber: number; field: string; message: string }[];
  } | null>(null);

  const createBatchMutation = trpc.imports.createBatch.useMutation();
  const addRecordsMutation = trpc.imports.addRecords.useMutation();
  const validateBatchMutation = trpc.imports.validateBatch.useMutation();
  const { data: invalidRecords } = trpc.imports.getInvalidRecords.useQuery(
    batchId ?? '',
    { enabled: !!batchId && validationResult !== null }
  );

  const runValidation = async () => {
    setIsValidating(true);

    try {
      // Create batch
      const batch = await createBatchMutation.mutateAsync({
        name: batchName,
        description: batchDescription,
        sourceSystem: sourceSystem as any,
        dataTypes: selectedDataTypes as any[],
        options: {
          enableRollback: true,
          skipDuplicates: true,
        },
      });

      setBatchId(batch.batchId);

      // Add records
      const records = parsedRecords.map((record, index) => ({
        rowNumber: index + 1,
        dataType: selectedDataTypes[0] as any, // Use first selected data type
        rawData: record,
      }));

      // Add in batches of 100
      for (let i = 0; i < records.length; i += 100) {
        await addRecordsMutation.mutateAsync({
          batchId: batch.batchId,
          records: records.slice(i, i + 100),
        });
      }

      // Validate
      const result = await validateBatchMutation.mutateAsync({
        batchId: batch.batchId,
      });

      setValidationResult({
        validRecords: result.validRecords,
        invalidRecords: result.invalidRecords,
        errors: [],
      });

      if (result.invalidRecords === 0) {
        toast.success('All records validated successfully!');
      } else {
        toast.error(`${result.invalidRecords} records have validation errors`);
      }
    } catch (error) {
      toast.error('Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const canProceed = validationResult && validationResult.invalidRecords === 0;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-medium mb-2">Validate Import Data</h3>
        <p className="text-sm text-muted-foreground">
          We'll check your data for errors before importing
        </p>
      </div>

      {!validationResult && (
        <div className="text-center py-8">
          <Button onClick={runValidation} disabled={isValidating} size="lg">
            {isValidating ? 'Validating...' : 'Start Validation'}
          </Button>
          {isValidating && (
            <div className="mt-4">
              <ProgressBar value={50} />
              <p className="text-sm text-muted-foreground mt-2">
                Validating {parsedRecords.length} records...
              </p>
            </div>
          )}
        </div>
      )}

      {validationResult && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-green-600">
                  {validationResult.validRecords}
                </CardTitle>
                <CardDescription>Valid Records</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className={`text-lg ${validationResult.invalidRecords > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {validationResult.invalidRecords}
                </CardTitle>
                <CardDescription>Invalid Records</CardDescription>
              </CardHeader>
            </Card>
          </div>

          {invalidRecords && invalidRecords.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-red-600">Validation Errors</h4>
              <div className="max-h-64 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Field</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invalidRecords.slice(0, 20).map((record: any, index) => (
                      <TableRow key={index}>
                        <TableCell>{record.rowNumber}</TableCell>
                        <TableCell>{record.validationErrors?.[0]?.field ?? '-'}</TableCell>
                        <TableCell className="text-red-600">
                          {record.validationErrors?.[0]?.message ?? 'Unknown error'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {invalidRecords.length > 20 && (
                <p className="text-sm text-muted-foreground">
                  Showing 20 of {invalidRecords.length} errors
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <div className="space-x-2">
          {validationResult && validationResult.invalidRecords > 0 && (
            <Button variant="outline" onClick={runValidation}>
              Re-validate
            </Button>
          )}
          <Button onClick={onNext} disabled={!canProceed}>
            Continue to Import
          </Button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Import Execution Step
// =============================================================================

function ImportExecutionStep({
  onNext,
  onBack,
  batchId,
}: {
  onNext: () => void;
  onBack: () => void;
  batchId: string;
}) {
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    importedRecords: number;
    skippedRecords: number;
    failedRecords: number;
  } | null>(null);

  const executeImportMutation = trpc.imports.executeImport.useMutation();
  const { data: progress, refetch: refetchProgress } = trpc.imports.getProgress.useQuery(
    batchId,
    { enabled: isImporting, refetchInterval: isImporting ? 1000 : false }
  );

  const startImport = async () => {
    setIsImporting(true);

    try {
      const result = await executeImportMutation.mutateAsync({
        batchId,
        options: { continueOnErrors: false },
      });

      setImportResult({
        importedRecords: result.importedRecords,
        skippedRecords: result.skippedRecords,
        failedRecords: result.failedRecords,
      });

      toast.success(`Successfully imported ${result.importedRecords} records!`);
    } catch (error) {
      toast.error('Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-medium mb-2">Import Data</h3>
        <p className="text-sm text-muted-foreground">
          Your data is ready to be imported into GLAPI
        </p>
      </div>

      {!importResult && (
        <div className="text-center py-8">
          <Button onClick={startImport} disabled={isImporting} size="lg">
            {isImporting ? 'Importing...' : 'Start Import'}
          </Button>
          {isImporting && progress && (
            <div className="mt-4 max-w-md mx-auto">
              <ProgressBar value={progress.percentComplete} />
              <p className="text-sm text-muted-foreground mt-2">
                Importing {progress.processedRecords} of {progress.totalRecords} records...
              </p>
            </div>
          )}
        </div>
      )}

      {importResult && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-green-600">
                  {importResult.importedRecords}
                </CardTitle>
                <CardDescription>Imported</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-yellow-600">
                  {importResult.skippedRecords}
                </CardTitle>
                <CardDescription>Skipped</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-red-600">
                  {importResult.failedRecords}
                </CardTitle>
                <CardDescription>Failed</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isImporting}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!importResult}>
          Complete
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Complete Step
// =============================================================================

function CompleteStep({
  batchId,
  onNewImport,
}: {
  batchId: string;
  onNewImport: () => void;
}) {
  const router = useRouter();
  const { data: batch } = trpc.imports.getBatch.useQuery(batchId);
  const { data: auditTrail } = trpc.imports.getAuditTrail.useQuery(batchId);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-6xl mb-4">✅</div>
        <h3 className="text-2xl font-bold mb-2">Import Complete!</h3>
        <p className="text-muted-foreground">
          Your data has been successfully imported into GLAPI
        </p>
      </div>

      {batch && (
        <Card>
          <CardHeader>
            <CardTitle>Import Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Batch Number</dt>
                <dd className="font-medium">{batch.batchNumber}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <Badge variant="outline" className="bg-green-50 text-green-700">
                    {batch.status}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Total Records</dt>
                <dd className="font-medium">{batch.totalRecords}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Imported Records</dt>
                <dd className="font-medium">{batch.importedRecords}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      {auditTrail && auditTrail.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Audit Trail</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {auditTrail.slice(0, 5).map((entry: any, index: number) => (
                <div key={index} className="flex items-center text-sm">
                  <span className="text-muted-foreground w-36">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                  <span>{entry.action}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-center gap-4">
        <Button variant="outline" onClick={onNewImport}>
          Start New Import
        </Button>
        <Button onClick={() => router.push('/dashboard')}>
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Main Migration Wizard Page
// =============================================================================

export default function MigrationWizardPage() {
  const { orgId } = useAuth();
  const [currentStep, setCurrentStep] = useState<WizardStep>('source');

  // Wizard state
  const [sourceSystem, setSourceSystem] = useState('');
  const [selectedDataTypes, setSelectedDataTypes] = useState<string[]>([]);
  const [batchName, setBatchName] = useState('');
  const [batchDescription, setBatchDescription] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedRecords, setParsedRecords] = useState<Record<string, unknown>[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);

  const steps: { id: WizardStep; label: string }[] = [
    { id: 'source', label: 'Source' },
    { id: 'upload', label: 'Upload' },
    { id: 'mapping', label: 'Mapping' },
    { id: 'validation', label: 'Validate' },
    { id: 'import', label: 'Import' },
    { id: 'complete', label: 'Complete' },
  ];

  const resetWizard = () => {
    setCurrentStep('source');
    setSourceSystem('');
    setSelectedDataTypes([]);
    setBatchName('');
    setBatchDescription('');
    setUploadedFile(null);
    setParsedRecords([]);
    setFieldMappings([]);
    setBatchId(null);
  };

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">
              Please select an organization to use the migration wizard.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Data Migration Wizard</h1>
        <p className="text-muted-foreground mb-8">
          Import data from external accounting systems into GLAPI
        </p>

        <Card>
          <CardContent className="pt-6">
            <StepIndicator steps={steps} currentStep={currentStep} />

            {currentStep === 'source' && (
              <SourceSelectionStep
                onNext={() => setCurrentStep('upload')}
                sourceSystem={sourceSystem}
                setSourceSystem={setSourceSystem}
                selectedDataTypes={selectedDataTypes}
                setSelectedDataTypes={setSelectedDataTypes}
              />
            )}

            {currentStep === 'upload' && (
              <UploadStep
                onNext={() => setCurrentStep('mapping')}
                onBack={() => setCurrentStep('source')}
                batchName={batchName}
                setBatchName={setBatchName}
                batchDescription={batchDescription}
                setBatchDescription={setBatchDescription}
                uploadedFile={uploadedFile}
                setUploadedFile={setUploadedFile}
                parsedRecords={parsedRecords}
                setParsedRecords={setParsedRecords}
                sourceSystem={sourceSystem}
              />
            )}

            {currentStep === 'mapping' && (
              <FieldMappingStep
                onNext={() => setCurrentStep('validation')}
                onBack={() => setCurrentStep('upload')}
                parsedRecords={parsedRecords}
                selectedDataTypes={selectedDataTypes}
                fieldMappings={fieldMappings}
                setFieldMappings={setFieldMappings}
              />
            )}

            {currentStep === 'validation' && (
              <ValidationStep
                onNext={() => setCurrentStep('import')}
                onBack={() => setCurrentStep('mapping')}
                batchId={batchId}
                setBatchId={setBatchId}
                batchName={batchName}
                batchDescription={batchDescription}
                sourceSystem={sourceSystem}
                selectedDataTypes={selectedDataTypes}
                parsedRecords={parsedRecords}
                fieldMappings={fieldMappings}
              />
            )}

            {currentStep === 'import' && batchId && (
              <ImportExecutionStep
                onNext={() => setCurrentStep('complete')}
                onBack={() => setCurrentStep('validation')}
                batchId={batchId}
              />
            )}

            {currentStep === 'complete' && batchId && (
              <CompleteStep batchId={batchId} onNewImport={resetWizard} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
