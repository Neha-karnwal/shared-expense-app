import { getDashboardData } from './actions';
import { redirect } from 'next/navigation';
import DashboardClient from '@/components/DashboardClient';

// Ensure the page is dynamic and checks database records on each render
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const data = await getDashboardData();
  
  if (data.error && data.error === 'Not authenticated') {
    redirect('/login');
  }

  // Redirect to import screen if no expenses exist in the DB
  const hasExpenses = data.expenses && data.expenses.length > 0;
  if (!hasExpenses) {
    redirect('/import');
  }

  return (
    <DashboardClient
      currentUser={data.currentUser}
      group={data.group}
      expenses={data.expenses}
      balances={data.balances}
      simplifiedPayments={data.simplifiedPayments}
    />
  );
}
