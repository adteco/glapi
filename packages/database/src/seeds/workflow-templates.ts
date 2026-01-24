import { db } from '../db';
import { workflows, workflowGroups, workflowComponents } from '../db/schema/workflows';
import type { WorkflowComponentType } from '../db/schema/workflows';
import { eq, and, isNull } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

interface ComponentDefinition {
  componentKey: string;
  displayName: string;
  componentType: WorkflowComponentType;
  route: string;
  icon?: string;
}

interface GroupDefinition {
  name: string;
  components: ComponentDefinition[];
}

interface TemplateDefinition {
  name: string;
  description: string;
  groups: GroupDefinition[];
}

// ============================================================================
// COMPONENT LIBRARY
// Available components with their default configurations
// ============================================================================

const COMPONENT_LIBRARY: Record<string, ComponentDefinition> = {
  // Relationships / Lists
  customers: {
    componentKey: 'customers',
    displayName: 'Customers',
    componentType: 'lists',
    route: '/relationships/customers',
    icon: 'Users',
  },
  vendors: {
    componentKey: 'vendors',
    displayName: 'Vendors',
    componentType: 'lists',
    route: '/relationships/vendors',
    icon: 'Building',
  },
  employees: {
    componentKey: 'employees',
    displayName: 'Employees',
    componentType: 'lists',
    route: '/relationships/employees',
    icon: 'UserCircle',
  },
  contacts: {
    componentKey: 'contacts',
    displayName: 'Contacts',
    componentType: 'lists',
    route: '/relationships/contacts',
    icon: 'Contact',
  },
  leads: {
    componentKey: 'leads',
    displayName: 'Leads',
    componentType: 'lists',
    route: '/relationships/leads',
    icon: 'UserPlus',
  },
  prospects: {
    componentKey: 'prospects',
    displayName: 'Prospects',
    componentType: 'lists',
    route: '/relationships/prospects',
    icon: 'Target',
  },

  // Projects & Time
  projects: {
    componentKey: 'projects',
    displayName: 'Projects',
    componentType: 'time_tracking',
    route: '/projects',
    icon: 'FolderKanban',
  },
  timeEntries: {
    componentKey: 'time_entries',
    displayName: 'Time Entries',
    componentType: 'time_tracking',
    route: '/projects/time',
    icon: 'Clock',
  },

  // Sales Transactions
  estimates: {
    componentKey: 'estimates',
    displayName: 'Estimates',
    componentType: 'transactions',
    route: '/transactions/sales/estimates',
    icon: 'FileText',
  },
  salesOrders: {
    componentKey: 'sales_orders',
    displayName: 'Sales Orders',
    componentType: 'transactions',
    route: '/transactions/sales/sales-orders',
    icon: 'ClipboardList',
  },
  opportunities: {
    componentKey: 'opportunities',
    displayName: 'Opportunities',
    componentType: 'transactions',
    route: '/transactions/sales/opportunities',
    icon: 'Sparkles',
  },
  fulfillment: {
    componentKey: 'fulfillment',
    displayName: 'Fulfillment',
    componentType: 'transactions',
    route: '/transactions/sales/fulfillment',
    icon: 'Package',
  },
  invoices: {
    componentKey: 'invoices',
    displayName: 'Invoices',
    componentType: 'transactions',
    route: '/transactions/sales/invoices',
    icon: 'Receipt',
  },
  payments: {
    componentKey: 'payments',
    displayName: 'Payments',
    componentType: 'transactions',
    route: '/payments',
    icon: 'CreditCard',
  },

  // Banking & Reconciliation
  bankReconciliation: {
    componentKey: 'bank_reconciliation',
    displayName: 'Bank Reconciliation',
    componentType: 'transactions',
    route: '/banking/reconciliation',
    icon: 'Building2',
  },
  statements: {
    componentKey: 'statements',
    displayName: 'Statements',
    componentType: 'transactions',
    route: '/statements',
    icon: 'FileSpreadsheet',
  },

  // Construction
  scheduleOfValues: {
    componentKey: 'schedule_of_values',
    displayName: 'Schedule of Values',
    componentType: 'construction',
    route: '/construction/sov',
    icon: 'ListChecks',
  },
  payApplications: {
    componentKey: 'pay_applications',
    displayName: 'Pay Applications',
    componentType: 'construction',
    route: '/construction/pay-applications',
    icon: 'FileCheck',
  },
};

// ============================================================================
// TEMPLATE DEFINITIONS
// ============================================================================

const WORKFLOW_TEMPLATES: TemplateDefinition[] = [
  // Template 1: Client to Cash (comprehensive workflow)
  {
    name: 'Client to Cash',
    description: 'Comprehensive workflow covering customer relationships, projects, quotes, billing, and reconciliation. Ideal for service businesses that manage projects and bill for time.',
    groups: [
      {
        name: 'Relationships',
        components: [COMPONENT_LIBRARY.customers],
      },
      {
        name: 'Projects',
        components: [COMPONENT_LIBRARY.projects, COMPONENT_LIBRARY.timeEntries],
      },
      {
        name: 'Quotes & Orders',
        components: [COMPONENT_LIBRARY.estimates, COMPONENT_LIBRARY.salesOrders],
      },
      {
        name: 'Billing',
        components: [COMPONENT_LIBRARY.invoices, COMPONENT_LIBRARY.payments],
      },
      {
        name: 'Reconciliation',
        components: [COMPONENT_LIBRARY.bankReconciliation, COMPONENT_LIBRARY.statements],
      },
    ],
  },

  // Template 2: Order to Cash (sales focused)
  {
    name: 'Order to Cash',
    description: 'Sales-focused workflow optimized for businesses that sell products or services through a traditional sales pipeline. Includes opportunities, estimates, orders, and fulfillment.',
    groups: [
      {
        name: 'Customers',
        components: [COMPONENT_LIBRARY.customers],
      },
      {
        name: 'Sales',
        components: [
          COMPONENT_LIBRARY.estimates,
          COMPONENT_LIBRARY.salesOrders,
          COMPONENT_LIBRARY.opportunities,
        ],
      },
      {
        name: 'Fulfillment',
        components: [COMPONENT_LIBRARY.fulfillment],
      },
      {
        name: 'Billing',
        components: [COMPONENT_LIBRARY.invoices, COMPONENT_LIBRARY.payments],
      },
    ],
  },

  // Template 3: Project Billing (service business)
  {
    name: 'Project Billing',
    description: 'Streamlined workflow for service businesses that bill primarily based on project work and time tracking. Perfect for consultants, agencies, and professional services.',
    groups: [
      {
        name: 'Clients',
        components: [COMPONENT_LIBRARY.customers],
      },
      {
        name: 'Projects',
        components: [COMPONENT_LIBRARY.projects, COMPONENT_LIBRARY.timeEntries],
      },
      {
        name: 'Billing',
        components: [COMPONENT_LIBRARY.invoices],
      },
    ],
  },

  // Template 4: Construction Billing
  {
    name: 'Construction Billing',
    description: 'Specialized workflow for construction companies using progress billing with Schedule of Values (SOV) and AIA-style pay applications.',
    groups: [
      {
        name: 'Clients',
        components: [COMPONENT_LIBRARY.customers],
      },
      {
        name: 'Projects',
        components: [COMPONENT_LIBRARY.projects],
      },
      {
        name: 'Progress Billing',
        components: [COMPONENT_LIBRARY.scheduleOfValues, COMPONENT_LIBRARY.payApplications],
      },
      {
        name: 'Invoicing',
        components: [COMPONENT_LIBRARY.invoices],
      },
    ],
  },
];

// ============================================================================
// SEED FUNCTION
// ============================================================================

export async function seedWorkflowTemplates(): Promise<void> {
  console.log('Starting workflow templates seeding...');

  for (const template of WORKFLOW_TEMPLATES) {
    console.log(`Processing template: ${template.name}`);

    // Check if template already exists (by name and is_template=true, organization_id=null)
    const existingTemplate = await db
      .select()
      .from(workflows)
      .where(
        and(
          eq(workflows.name, template.name),
          eq(workflows.isTemplate, true),
          isNull(workflows.organizationId)
        )
      );

    if (existingTemplate.length > 0) {
      console.log(`  Template "${template.name}" already exists, skipping...`);
      continue;
    }

    // Create the workflow template
    const [workflow] = await db
      .insert(workflows)
      .values({
        organizationId: null, // System-wide template
        name: template.name,
        description: template.description,
        isTemplate: true,
        isActive: true,
      })
      .returning();

    console.log(`  Created workflow: ${workflow.id}`);

    // Create groups and components
    let groupOrder = 0;
    for (const group of template.groups) {
      // Create the group
      const [workflowGroup] = await db
        .insert(workflowGroups)
        .values({
          workflowId: workflow.id,
          name: group.name,
          displayOrder: groupOrder++,
        })
        .returning();

      console.log(`    Created group: ${group.name} (${workflowGroup.id})`);

      // Create components within the group
      let componentOrder = 0;
      for (const component of group.components) {
        await db.insert(workflowComponents).values({
          workflowId: workflow.id,
          groupId: workflowGroup.id,
          componentType: component.componentType,
          componentKey: component.componentKey,
          displayName: component.displayName,
          icon: component.icon || null,
          route: component.route,
          displayOrder: componentOrder++,
          isEnabled: true,
        });

        console.log(`      Created component: ${component.displayName}`);
      }
    }
  }

  console.log('Workflow templates seeding completed.');
}

// ============================================================================
// STANDALONE EXECUTION
// ============================================================================

// Allow running this script directly
const isMainModule = require.main === module;

if (isMainModule) {
  seedWorkflowTemplates()
    .then(() => {
      console.log('Done.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error seeding workflow templates:', error);
      process.exit(1);
    });
}
