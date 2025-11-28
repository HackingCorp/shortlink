import { Sidebar } from '@/components/Sidebar';
import { ToasterProvider } from '@/components/providers/ToasterProvider';
import 'react-tooltip/dist/react-tooltip.css';

// Ce layout protège toutes les pages enfants. NextAuth redirigera si non connecté.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ToasterProvider />
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </>
  );
}