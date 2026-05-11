import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sprout } from 'lucide-react';

const Producers = () => (
  <div className="space-y-6">
    <h2 className="text-xl font-bold">Produtores</h2>
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Sprout className="h-4 w-4 text-primary" />
          Em desenvolvimento
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          Esta área está sendo construída. Em breve você poderá cadastrar e
          gerenciar produtores por aqui.
        </p>
      </CardContent>
    </Card>
  </div>
);

export default Producers;
