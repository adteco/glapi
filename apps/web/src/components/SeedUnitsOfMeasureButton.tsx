'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useApiClient } from '@/lib/api-client.client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export function SeedUnitsOfMeasureButton() {
  const { orgId } = useAuth();
  const { apiPost } = useApiClient();
  const [isSeeding, setIsSeeding] = useState(false);

  const seedUnits = async () => {
    if (!orgId) {
      toast.error('No active organization selected. Please select or create an organization.');
      return;
    }

    setIsSeeding(true);
    try {
      // Common units of measure to seed
      const unitsToSeed = [
        // Weight
        { name: 'Kilogram', abbreviation: 'kg', code: 'KG', baseConversionFactor: 1, decimalPlaces: 2 },
        { name: 'Gram', abbreviation: 'g', code: 'G', baseConversionFactor: 0.001, decimalPlaces: 2 },
        { name: 'Pound', abbreviation: 'lb', code: 'LB', baseConversionFactor: 0.453592, decimalPlaces: 2 },
        { name: 'Ounce', abbreviation: 'oz', code: 'OZ', baseConversionFactor: 0.0283495, decimalPlaces: 2 },
        { name: 'Ton', abbreviation: 't', code: 'TON', baseConversionFactor: 1000, decimalPlaces: 2 },
        
        // Length
        { name: 'Meter', abbreviation: 'm', code: 'M', baseConversionFactor: 1, decimalPlaces: 2 },
        { name: 'Centimeter', abbreviation: 'cm', code: 'CM', baseConversionFactor: 0.01, decimalPlaces: 2 },
        { name: 'Inch', abbreviation: 'in', code: 'IN', baseConversionFactor: 0.0254, decimalPlaces: 2 },
        { name: 'Foot', abbreviation: 'ft', code: 'FT', baseConversionFactor: 0.3048, decimalPlaces: 2 },
        { name: 'Yard', abbreviation: 'yd', code: 'YD', baseConversionFactor: 0.9144, decimalPlaces: 2 },
        
        // Volume
        { name: 'Liter', abbreviation: 'L', code: 'L', baseConversionFactor: 1, decimalPlaces: 2 },
        { name: 'Milliliter', abbreviation: 'mL', code: 'ML', baseConversionFactor: 0.001, decimalPlaces: 3 },
        { name: 'Gallon', abbreviation: 'gal', code: 'GAL', baseConversionFactor: 3.78541, decimalPlaces: 2 },
        { name: 'Quart', abbreviation: 'qt', code: 'QT', baseConversionFactor: 0.946353, decimalPlaces: 2 },
        { name: 'Pint', abbreviation: 'pt', code: 'PT', baseConversionFactor: 0.473176, decimalPlaces: 2 },
        
        // Count
        { name: 'Each', abbreviation: 'ea', code: 'EA', baseConversionFactor: 1, decimalPlaces: 0 },
        { name: 'Dozen', abbreviation: 'dz', code: 'DZ', baseConversionFactor: 12, decimalPlaces: 0 },
        { name: 'Case', abbreviation: 'cs', code: 'CS', baseConversionFactor: 1, decimalPlaces: 0 },
        { name: 'Box', abbreviation: 'bx', code: 'BX', baseConversionFactor: 1, decimalPlaces: 0 },
        { name: 'Pack', abbreviation: 'pk', code: 'PK', baseConversionFactor: 1, decimalPlaces: 0 },
      ];

      let successCount = 0;
      let errorCount = 0;

      for (const unit of unitsToSeed) {
        try {
          await apiPost('/api/units-of-measure', {
            code: unit.code,
            name: unit.name,
            abbreviation: unit.abbreviation,
            baseConversionFactor: unit.baseConversionFactor,
            decimalPlaces: unit.decimalPlaces,
          });
          successCount++;
        } catch (error) {
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully created ${successCount} units of measure`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to create ${errorCount} units (may already exist)`);
      }

      // Refresh the page
      window.location.reload();
    } catch (error) {
      console.error('Error seeding units:', error);
      toast.error('Failed to seed units of measure');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <Button
      onClick={seedUnits}
      disabled={isSeeding || !orgId}
      variant="outline"
    >
      {isSeeding ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Seeding...
        </>
      ) : (
        'Seed Common Units'
      )}
    </Button>
  );
}