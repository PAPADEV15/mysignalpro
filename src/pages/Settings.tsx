import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

interface AppSetting {
  id: string;
  key: string;
  value_json: Json;
  updated_at: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from('app_settings').select('*').order('key')
      .then(({ data }) => { if (data) setSettings(data); setLoading(false); });
  }, []);

  const saveOne = async (id: string, key: string) => {
    const raw = edits[key];
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const { error } = await supabase.from('app_settings').update({ value_json: parsed }).eq('id', id);
      if (error) { toast.error(error.message); return; }
      toast.success(`${key} saved`);
      const { data } = await supabase.from('app_settings').select('*').order('key');
      if (data) setSettings(data);
      setEdits(prev => { const n = { ...prev }; delete n[key]; return n; });
    } catch {
      toast.error('Invalid JSON');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      <p className="text-sm text-muted-foreground">Configure strategy parameters, risk, timing, and filters. All values are JSON.</p>

      {loading ? <div className="text-muted-foreground animate-pulse">Loading...</div> : (
        <div className="space-y-4">
          {settings.map(s => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono">{s.key}</CardTitle>
                <span className="text-xs text-muted-foreground">Updated: {new Date(s.updated_at).toLocaleString()}</span>
              </CardHeader>
              <CardContent className="space-y-2">
                <textarea
                  className="w-full min-h-[80px] bg-muted border border-border rounded-md p-2 text-sm font-mono text-foreground resize-y"
                  value={edits[s.key] ?? JSON.stringify(s.value_json, null, 2)}
                  onChange={e => setEdits(prev => ({ ...prev, [s.key]: e.target.value }))}
                />
                {edits[s.key] !== undefined && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveOne(s.id, s.key)}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEdits(prev => { const n = { ...prev }; delete n[s.key]; return n; })}>Cancel</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
