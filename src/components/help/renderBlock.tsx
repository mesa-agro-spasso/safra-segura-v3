import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { HelpBlock } from '@/data/helpContent';

export function renderBlock(block: HelpBlock, key: number) {
  switch (block.type) {
    case 'p':
      return (
        <p key={key} className="text-sm leading-relaxed text-foreground/80 my-2">
          {block.text}
        </p>
      );
    case 'h3':
      return (
        <h3 key={key} className="text-base font-semibold mt-6 mb-2 text-foreground">
          {block.text}
        </h3>
      );
    case 'callout':
      return (
        <div
          key={key}
          className="border-l-2 border-primary bg-muted/40 px-4 py-2 my-3 text-sm text-foreground/90"
        >
          {block.text}
        </div>
      );
    case 'list':
      return (
        <ul key={key} className="list-disc pl-5 space-y-1 text-sm text-foreground/80 my-2">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case 'table':
      return (
        <div key={key} className="my-3 rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {block.headers.map((h, i) => (
                  <TableHead key={i} className="text-xs font-semibold">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {block.rows.map((row, i) => (
                <TableRow key={i}>
                  {row.map((cell, j) => (
                    <TableCell key={j} className="text-xs align-top py-2">
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );
  }
}
