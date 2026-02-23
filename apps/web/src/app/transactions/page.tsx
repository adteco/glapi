import { redirect } from 'next/navigation';

export default function TransactionsIndexPage() {
  redirect('/transactions/sales/invoices');
}
