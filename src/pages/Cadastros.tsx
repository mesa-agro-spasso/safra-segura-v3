import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EntityTab } from '@/components/cadastros/EntityTab';
import { ENTITY_CONFIGS } from '@/components/cadastros/entityConfigs';

export default function Cadastros() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Cadastros</h1>
        <p className="text-sm text-muted-foreground">
          Entidades de referência do sistema. Registros não podem ser excluídos — apenas inativados.
        </p>
      </div>

      <Tabs defaultValue={ENTITY_CONFIGS[0].table}>
        <TabsList>
          {ENTITY_CONFIGS.map((c) => (
            <TabsTrigger key={c.table} value={c.table}>
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {ENTITY_CONFIGS.map((c) => (
          <TabsContent key={c.table} value={c.table} className="mt-4">
            <EntityTab config={c} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
