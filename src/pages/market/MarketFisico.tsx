import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Layers } from 'lucide-react';

export default function MarketFisico() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-muted-foreground" />
            Mercado Físico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <p className="text-lg font-medium mb-2">Em breve</p>
            <p className="text-sm max-w-md">
              A visualização de preços do mercado físico será disponibilizada em uma próxima etapa.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
