import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface WatchlistPair {
  id: string;
  symbol: string;
  is_active: boolean;
  priority: number;
}

export default function Watchlist() {
  const { isAdmin } = useAuth();
  const [pairs, setPairs] = useState<WatchlistPair[]>([]);
  const [newSymbol, setNewSymbol] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchPairs(); }, []);

  const fetchPairs = async () => {
    const { data } = await supabase.from('watchlist_pairs').select('*').order('priority');
    if (data) setPairs(data);
    setLoading(false);
  };

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from('watchlist_pairs').update({ is_active: active }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    fetchPairs();
  };

  const addPair = async () => {
    const sym = newSymbol.toUpperCase().trim();
    if (!sym) return;
    const { error } = await supabase.from('watchlist_pairs').insert({ symbol: sym, priority: pairs.length + 1 });
    if (error) { toast.error(error.message); return; }
    setNewSymbol('');
    fetchPairs();
    toast.success(`${sym} added`);
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground">Watchlist</h1>

      {isAdmin && (
        <div className="flex gap-2">
          <Input placeholder="Symbol (e.g. AVAXUSDT)" value={newSymbol} onChange={e => setNewSymbol(e.target.value)} className="max-w-xs" />
          <Button onClick={addPair}>Add Pair</Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {pairs.map(pair => (
            <div key={pair.id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-6">#{pair.priority}</span>
                <span className="font-bold text-sm">{pair.symbol}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs ${pair.is_active ? 'text-success' : 'text-muted-foreground'}`}>
                  {pair.is_active ? 'Active' : 'Inactive'}
                </span>
                {isAdmin && (
                  <Switch checked={pair.is_active} onCheckedChange={v => toggleActive(pair.id, v)} />
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
