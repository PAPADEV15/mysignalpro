import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AuditEntry {
  id: string;
  event_type: string;
  severity: string;
  source: string;
  message: string;
  details_json: any;
  created_at: string;
}

export default function Audit() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('all');

  useEffect(() => {
    supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => { if (data) setLogs(data); setLoading(false); });
  }, []);

  const filtered = logs.filter(l => severityFilter === 'all' || l.severity === severityFilter);

  const severityColors: Record<string, string> = {
    info: 'bg-info/20 text-info',
    warning: 'bg-warning/20 text-warning',
    error: 'bg-destructive/20 text-destructive',
    critical: 'bg-destructive text-destructive-foreground',
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-muted-foreground animate-pulse">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No audit entries yet.</CardContent></Card>
      ) : (
        <div className="space-y-1">
          {filtered.map(entry => (
            <Card key={entry.id}>
              <CardContent className="p-3 flex items-start gap-3">
                <Badge className={severityColors[entry.severity] || ''}>{entry.severity}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <span className="font-mono">{entry.source}</span>
                    <span>•</span>
                    <span>{entry.event_type}</span>
                    <span>•</span>
                    <span>{new Date(entry.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-foreground">{entry.message}</p>
                  {entry.details_json && (
                    <pre className="text-xs text-muted-foreground mt-1 overflow-auto max-h-24">
                      {JSON.stringify(entry.details_json, null, 2)}
                    </pre>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
