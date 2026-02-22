import { redirect } from 'next/navigation';

export default function ContractsRedirectPage() {
  redirect('/transactions/recurring/contracts');
}

