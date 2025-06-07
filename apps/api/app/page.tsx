export default function Home() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>GLAPI - Accounting Dimensions API</h1>
      <p>API Server is running on port 3001</p>
      <h2>Available Endpoints:</h2>
      <ul style={{ lineHeight: '1.8' }}>
        <li><code>/api</code> - Health check</li>
        <li><code>/api/organizations</code> - Organizations management</li>
        <li><code>/api/customers</code> - Customers management</li>
        <li><code>/api/vendors</code> - Vendors management</li>
        <li><code>/api/contacts</code> - Contacts management</li>
        <li><code>/api/employees</code> - Employees management</li>
        <li><code>/api/leads</code> - Leads management</li>
        <li><code>/api/prospects</code> - Prospects management</li>
        <li><code>/api/subsidiaries</code> - Subsidiaries management</li>
        <li><code>/api/departments</code> - Departments management</li>
        <li><code>/api/locations</code> - Locations management</li>
        <li><code>/api/classes</code> - Classes management</li>
        <li><code>/api/gl/accounts</code> - GL Accounts management</li>
        <li><code>/api/gl/transactions</code> - GL Transactions</li>
        <li><code>/api/gl/reports/trial-balance</code> - Trial Balance Report</li>
      </ul>
      <p style={{ marginTop: '2rem', color: '#666' }}>
        For detailed API documentation, visit the <a href="http://localhost:3000" target="_blank" rel="noopener noreferrer">documentation site</a>.
      </p>
    </div>
  );
}