import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  useStytchMemberSession,
  useStytchOrganization,
} from '@stytch/nextjs/b2b';
import CustomersWidget from '@/app/dashboard/customers-widget';
import SubsidiariesWidget from '@/app/dashboard/subsidiaries-widget';
import './Dashboard.css';

const Dashboard = () => {
  const { session, isInitialized } = useStytchMemberSession();
  const { organization } = useStytchOrganization();
  const router = useRouter();

  const role = useMemo(() => {
    return session?.roles.includes('stytch_admin') ? 'admin' : 'member';
  }, [session?.roles]);

  if (!isInitialized) {
    return <div>Loading...</div>;
  }

  if (isInitialized && !session) {
    return router.replace("/")
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Welcome to GLAPI Dashboard</h1>
        <p className="text-gray-600">
          You're logged into <strong>{organization?.organization_name}</strong> with <strong>{role}</strong> permissions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Customer Widget */}
        <div className="col-span-1">
          <CustomersWidget />
        </div>

        {/* Subsidiary Widget */}
        <div className="col-span-1">
          <SubsidiariesWidget />
        </div>

        {/* Additional widgets can be added here */}
        <div className="col-span-1 bg-white rounded-lg shadow p-5">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            <div className="border-l-4 border-green-500 pl-3 py-1">
              <div className="text-sm font-medium">New subsidiary added</div>
              <div className="text-xs text-gray-500">Today, 10:35 AM</div>
            </div>
            <div className="border-l-4 border-blue-500 pl-3 py-1">
              <div className="text-sm font-medium">Customer updated</div>
              <div className="text-xs text-gray-500">Yesterday, 2:15 PM</div>
            </div>
            <div className="border-l-4 border-purple-500 pl-3 py-1">
              <div className="text-sm font-medium">New user joined</div>
              <div className="text-xs text-gray-500">May 9, 2025</div>
            </div>
          </div>
        </div>

        <div className="col-span-1 lg:col-span-2 bg-white rounded-lg shadow p-5">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => router.push('/customers/new')}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
            >
              Add New Customer
            </button>
            <button
              onClick={() => router.push('/subsidiaries/new')}
              className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded"
            >
              Add New Subsidiary
            </button>
            <button
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded"
            >
              Generate Report
            </button>
            <button
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded"
            >
              View Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;