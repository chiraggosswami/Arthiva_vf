import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useLocation } from 'wouter';
import { Search } from 'lucide-react';
import { useAppState } from '../state/AppState';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { orders } = useAppState();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  if (!open) return null;

  return (
    <div className="cmd-overlay" onClick={() => setOpen(false)}>
      <div className="cmd-dialog" onClick={(e) => e.stopPropagation()}>
        <Command label="Command Menu" filter={(value, search) => {
          if (value.toLowerCase().includes(search.toLowerCase())) return 1;
          return 0;
        }}>
          <div className="cmd-header">
            <Search size={18} />
            <Command.Input autoFocus placeholder="Type a command or search orders..." />
          </div>
          <Command.List>
            <Command.Empty>No results found.</Command.Empty>

            <Command.Group heading="Pages">
              <Command.Item onSelect={() => { setLocation('/'); setOpen(false); }}>Command Centre</Command.Item>
              <Command.Item onSelect={() => { setLocation('/orders'); setOpen(false); }}>All Orders</Command.Item>
              <Command.Item onSelect={() => { setLocation('/rescue'); setOpen(false); }}>Delivery Rescue</Command.Item>
              <Command.Item onSelect={() => { setLocation('/recovery'); setOpen(false); }}>RTO Recovery</Command.Item>
              <Command.Item onSelect={() => { setLocation('/journeys'); setOpen(false); }}>Journey Rules</Command.Item>
              <Command.Item onSelect={() => { setLocation('/intelligence'); setOpen(false); }}>Intelligence</Command.Item>
              <Command.Item onSelect={() => { setLocation('/integrations'); setOpen(false); }}>Integrations</Command.Item>
              <Command.Item onSelect={() => { setLocation('/lab'); setOpen(false); }}>Simulation Lab</Command.Item>
              <Command.Item onSelect={() => { setLocation('/demo'); setOpen(false); }}>Demo Mode</Command.Item>
            </Command.Group>

            <Command.Group heading="Recent Orders">
              {orders.slice(0, 5).map(o => (
                <Command.Item key={o.id} onSelect={() => { setLocation(`/orders/${o.id}`); setOpen(false); }}>
                  Go to order {o.id} ({o.customerName || 'Customer'})
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
