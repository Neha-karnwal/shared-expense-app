import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ImportWizardWrapper from '@/components/ImportWizardWrapper';

export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Mini Header */}
      <header style={{
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(7, 10, 19, 0.8)',
        backdropFilter: 'blur(12px)',
        padding: '16px 0'
      }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{
            fontSize: '20px',
            fontWeight: '800',
            background: 'linear-gradient(135deg, #818cf8 0%, #c084fc 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            SplitFlat
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Reconciliation Wizard
          </div>
        </div>
      </header>

      <main className="container" style={{ flex: 1, padding: '40px 0' }}>
        <ImportWizardWrapper />
      </main>
    </div>
  );
}
