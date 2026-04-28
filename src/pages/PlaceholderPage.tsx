import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
}

const PlaceholderPage = ({ title }: PlaceholderPageProps) => (
  <div className="p-6 lg:p-8 flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
    <Construction className="w-12 h-12 text-muted-foreground" />
    <h1 className="text-2xl font-bold text-foreground">{title}</h1>
    <p className="text-muted-foreground">Esta seção está sendo implementada.</p>
  </div>
);

export default PlaceholderPage;
