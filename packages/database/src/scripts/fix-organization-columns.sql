-- Check and add organization_id columns if they don't exist

-- For classes table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'classes' AND column_name = 'organization_id') 
    THEN
        ALTER TABLE classes ADD COLUMN organization_id uuid NOT NULL;
        ALTER TABLE classes ADD CONSTRAINT classes_organization_id_organizations_id_fk 
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
    END IF;
END $$;

-- For departments table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'departments' AND column_name = 'organization_id') 
    THEN
        ALTER TABLE departments ADD COLUMN organization_id uuid NOT NULL;
        ALTER TABLE departments ADD CONSTRAINT departments_organization_id_organizations_id_fk 
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
    END IF;
END $$;

-- For locations table  
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'locations' AND column_name = 'organization_id') 
    THEN
        ALTER TABLE locations ADD COLUMN organization_id uuid NOT NULL;
        ALTER TABLE locations ADD CONSTRAINT locations_organization_id_organizations_id_fk 
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
    END IF;
END $$;

-- For subsidiaries table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'subsidiaries' AND column_name = 'organization_id') 
    THEN
        ALTER TABLE subsidiaries ADD COLUMN organization_id uuid NOT NULL;
        ALTER TABLE subsidiaries ADD CONSTRAINT subsidiaries_organization_id_organizations_id_fk 
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
    END IF;
END $$;

-- Add other missing columns to classes
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'classes' AND column_name = 'code') 
    THEN
        ALTER TABLE classes ADD COLUMN code varchar(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'classes' AND column_name = 'description') 
    THEN
        ALTER TABLE classes ADD COLUMN description varchar(1000);
    END IF;
END $$;

-- Add other missing columns to departments
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'departments' AND column_name = 'code') 
    THEN
        ALTER TABLE departments ADD COLUMN code varchar(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'departments' AND column_name = 'description') 
    THEN
        ALTER TABLE departments ADD COLUMN description varchar(1000);
    END IF;
END $$;

-- Add other missing columns to locations
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'locations' AND column_name = 'code') 
    THEN
        ALTER TABLE locations ADD COLUMN code varchar(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'locations' AND column_name = 'description') 
    THEN
        ALTER TABLE locations ADD COLUMN description varchar(1000);
    END IF;
END $$;

-- Add other missing columns to subsidiaries
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'subsidiaries' AND column_name = 'code') 
    THEN
        ALTER TABLE subsidiaries ADD COLUMN code varchar(50) NOT NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'subsidiaries' AND column_name = 'description') 
    THEN
        ALTER TABLE subsidiaries ADD COLUMN description varchar(1000);
    END IF;
END $$;