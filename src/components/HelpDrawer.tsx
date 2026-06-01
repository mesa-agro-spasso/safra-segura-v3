import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { helpSections } from '@/data/helpContent';
import { renderBlock } from '@/components/help/renderBlock';
import { cn } from '@/lib/utils';

const ROUTE_TO_SECTION: Record<string, string> = {
  '/': 'tabela-de-precos',
  '/operacoes-d24': 'operacoes',
  '/ordens-d24': 'ordens',
  '/armazens-d24': 'armazens',
  '/mercado': 'mercado',
  '/configuracoes': 'configuracoes',
  '/aprovacoes': 'aprovacoes',
  '/admin/usuarios': 'administracao',
  '/perfil': 'perfil',
};

export function HelpDrawer() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (!open) return;
    const targetId =
      ROUTE_TO_SECTION[pathname] ??
      (pathname.startsWith('/mercado') ? 'mercado' : undefined);
    const t = setTimeout(() => {
      if (targetId && sectionRefs.current[targetId]) {
        sectionRefs.current[targetId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 80);
    return () => clearTimeout(t);
  }, [open, pathname]);

  const scrollTo = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label="Abrir ajuda"
          className="gap-1.5 text-xs font-medium"
        >
          <HelpCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Ajuda</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[480px] sm:max-w-[480px] p-0 flex flex-col"
      >
        <SheetHeader className="px-6 pt-6 pb-3 border-b">
          <SheetTitle>Ajuda</SheetTitle>
          <div className="flex flex-wrap gap-1.5 pt-2">
            {helpSections.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={cn(
                  'text-[11px] px-2 py-0.5 rounded-full border transition-colors',
                  'border-border text-foreground/70 hover:bg-muted hover:text-foreground',
                )}
              >
                {s.title.replace(/^\d+\.\s*/, '')}
              </button>
            ))}
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {helpSections.map((section) => (
            <section
              key={section.id}
              ref={(el) => {
                sectionRefs.current[section.id] = el;
              }}
              className="mb-8 scroll-mt-4"
            >
              <h2 className="text-base font-bold mb-2 pb-1.5 border-b">{section.title}</h2>
              {section.blocks.map((b, i) => renderBlock(b, i))}
            </section>
          ))}
        </div>
        <div className="border-t px-6 py-3">
          <button
            onClick={() => {
              setOpen(false);
              navigate('/ajuda');
            }}
            className="text-sm text-primary hover:underline"
          >
            Ver manual completo →
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
