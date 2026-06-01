import { useEffect, useRef, useState } from 'react';
import { helpSections } from '@/data/helpContent';
import { renderBlock } from '@/components/help/renderBlock';
import { cn } from '@/lib/utils';

export default function Ajuda() {
  const [activeId, setActiveId] = useState<string>(helpSections[0]?.id ?? '');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: [0, 0.25, 0.5, 1] },
    );
    helpSections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const handleNav = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex gap-8 max-w-6xl mx-auto">
      <aside className="w-[220px] shrink-0 hidden md:block">
        <div className="sticky top-4">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            Manual
          </h2>
          <nav className="flex flex-col gap-1">
            {helpSections.map((s) => (
              <button
                key={s.id}
                onClick={() => handleNav(s.id)}
                className={cn(
                  'text-left text-sm px-2 py-1.5 rounded-md transition-colors',
                  activeId === s.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground/70 hover:bg-muted hover:text-foreground',
                )}
              >
                {s.title}
              </button>
            ))}
          </nav>
        </div>
      </aside>
      <div ref={containerRef} className="flex-1 min-w-0">
        <h1 className="text-2xl font-bold mb-2">Ajuda</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Manual completo da Mesa Integrada de Hedge.
        </p>
        {helpSections.map((section) => (
          <section key={section.id} id={section.id} className="mb-12 scroll-mt-4">
            <h2 className="text-xl font-bold mb-3 pb-2 border-b">{section.title}</h2>
            {section.blocks.map((b, i) => renderBlock(b, i))}
          </section>
        ))}
      </div>
    </div>
  );
}
