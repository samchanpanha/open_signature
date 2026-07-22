'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ArrowLeft, RefreshCw, Download, Search, Filter,
  ChevronLeft, ChevronRight, Activity, X
} from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  details: string | null;
  resourceType: string | null;
  resourceId: string | null;
  method: string | null;
  path: string | null;
  statusCode: number | null;
  duration: number | null;
  ipAddress: string | null;
  createdAt: string;
  userName: string;
  userId: string | null;
}

interface Filters {
  actions: string[];
  resourceTypes: string[];
}

export default function AuditLogsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({ actions: [], resourceTypes: [] });
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const limit = 50;

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  useEffect(() => { loadLogs(); }, [page]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (actionFilter !== 'all') params.set('action', actionFilter);
      if (resourceFilter !== 'all') params.set('resourceType', resourceFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/super-admin/audit-logs?${params}`, { headers: headers() });
      if (res.status === 403) { toast.error('Super admin access required'); router.push('/'); return; }
      if (res.ok) {
        const d = await res.json();
        setLogs(d.logs);
        setTotal(d.total);
        setFilters(d.filters);
      } else toast.error('Failed to load audit logs');
    } catch { toast.error('Failed to load audit logs'); }
    finally { setLoading(false); }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (actionFilter !== 'all') params.set('action', actionFilter);
      if (resourceFilter !== 'all') params.set('resourceType', resourceFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/super-admin/audit-logs/export?${params}`, { headers: headers() });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Export downloaded');
      } else toast.error('Export failed');
    } catch { toast.error('Export failed'); }
  };

  const clearFilters = () => {
    setSearch(''); setActionFilter('all'); setResourceFilter('all');
    setStartDate(''); setEndDate(''); setPage(1);
  };

  const hasActiveFilters = search || actionFilter !== 'all' || resourceFilter !== 'all' || startDate || endDate;

  const formatDate = (d: string) => new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const getActionColor = (action: string) => {
    if (action.includes('DELETE') || action.includes('REJECT')) return 'bg-red-100 text-red-700 border-red-200';
    if (action.includes('CREATE') || action.includes('REGISTER')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (action.includes('UPDATE') || action.includes('EDIT')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (action.includes('LOGIN') || action.includes('AUTH')) return 'bg-purple-100 text-purple-700 border-purple-200';
    if (action.includes('SIGN')) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (action.includes('SUPER_ADMIN')) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push('/admin/system')}>
              <ArrowLeft className="w-4 h-4 mr-1" /> System Admin
            </Button>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              <h1 className="text-2xl font-bold">Audit Logs</h1>
            </div>
            <Badge variant="outline">{total.toLocaleString()} entries</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadLogs}><RefreshCw className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="w-4 h-4 mr-1" /> Export CSV</Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs mb-1 block">Search</Label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search actions, details..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadLogs()}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="min-w-[180px]">
                <Label className="text-xs mb-1 block">Action</Label>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {filters.actions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[180px]">
                <Label className="text-xs mb-1 block">Resource Type</Label>
                <Select value={resourceFilter} onValueChange={setResourceFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {filters.resourceTypes.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[150px]">
                <Label className="text-xs mb-1 block">Start Date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="min-w-[150px]">
                <Label className="text-xs mb-1 block">End Date</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button onClick={loadLogs} size="sm"><Filter className="w-4 h-4 mr-1" /> Apply</Button>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}><X className="w-4 h-4 mr-1" /> Clear</Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : logs.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No audit logs found</TableCell></TableRow>
                ) : logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs font-mono whitespace-nowrap">{formatDate(log.createdAt)}</TableCell>
                    <TableCell><Badge variant="outline" className={`text-xs ${getActionColor(log.action)}`}>{log.action}</Badge></TableCell>
                    <TableCell className="text-sm">{log.userName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{log.resourceType || '—'}</TableCell>
                    <TableCell className="text-xs font-mono">{log.method || '—'}</TableCell>
                    <TableCell className="text-xs font-mono max-w-[200px] truncate" title={log.path || ''}>{log.path || '—'}</TableCell>
                    <TableCell>
                      {log.statusCode ? (
                        <Badge variant="outline" className={
                          log.statusCode >= 500 ? 'bg-red-100 text-red-700' :
                          log.statusCode >= 400 ? 'bg-amber-100 text-amber-700' :
                          'bg-emerald-100 text-emerald-700'
                        }>{log.statusCode}</Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.ipAddress || '—'}</TableCell>
                    <TableCell className="text-xs max-w-[250px] truncate" title={log.details || ''}>{log.details || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {total === 0 ? 0 : (page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm">Page {page}</span>
            <Button variant="outline" size="sm" disabled={page * limit >= total} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
