'use client';

import { useRouter } from 'next/navigation';
import ImportWizard from './ImportWizard';

export default function ImportWizardWrapper() {
  const router = useRouter();

  const handleComplete = (reportId) => {
    // Navigate back to dashboard and refresh the state
    router.push('/');
    router.refresh();
  };

  return <ImportWizard onImportComplete={handleComplete} />;
}
