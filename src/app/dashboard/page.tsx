'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, FileText, Workflow, Settings, Users, Bell,
  Plus, Upload, Search, ChevronRight, TrendingUp, TrendingDown,
  Clock, CheckCircle2, XCircle, AlertTriangle, File,
  ArrowUpRight, ArrowDownRight, BarChart3, Activity,
  LogOut, Sun, Moon, FolderOpen, Send, Eye, MoreHorizontal,
  RefreshCw, Download, Zap, Building2,
} from 'lucide-react';
import { toast } from 'sonner';

interface DashboardData {
  stats: {
    total: number;
    completed: number;
    pending: number;
    draft: number;
    rejected: number;
    expired: number;
    avgCompletionHours: number;
  };
  trendData: { date: string; created: number; completed: number }[];
  weeklyActivity: { week: string; created: number; completed: number }[];
  statusDistribution: { name: string; value: number; fill: string }[];
  recentDocuments: {
    id: string;
    title: string;
    status: string;
    createdAt: string;
    signerCount: number;
    signedCount: number;
  }[];
}

const trendChartConfig = {
  created: { label: 'Created', color: 'var(--chart-1)' },
  completed: { label: 'Completed', color: 'var(--chart-2)' },
} satisfies ChartConfig;

const weeklyChartConfig = {
  created: { label: 'Created', color: 'var(--chart-1)' },
  completed: { label: 'Completed', color: 'var(--chart-2)' },
} satisfies ChartConfig;

const statusChartConfig = {
  Completed: { label: 'Completed', color: '#10b981' },
  Pending: { label: 'Pending', color: '#f59e0b' },
  Draft: { label: 'Draft', color: '#94a3b8' },
  Rejected: { label: 'Rejected', color: '#ef4444' },
  Expired: { label: 'Expired', color: '#8b5cf6' },
} satisfies ChartConfig;

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'workflows', label: 'Workflows', icon: Workflow },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const statusColors: Record<string, string> = {
  Completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  Sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Signing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  Rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Expired: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/dashboard', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        setData(await res.json());
      } else if (res.status === 401) {
        router.push('/');
      }
    } catch {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const formatHours = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours}h`;
    return `${Math.round(hours / 24)}d`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const statCards = data ? [
    {
      label: 'Total Documents',
      value: data.stats.total,
      icon: FileText,
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      change: null,
    },
    {
      label: 'Completed',
      value: data.stats.completed,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      change: data.stats.total > 0 ? Math.round((data.stats.completed / data.stats.total) * 100) : 0,
      changeLabel: 'completion rate',
      positive: true,
    },
    {
      label: 'Pending',
      value: data.stats.pending,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      change: null,
    },
    {
      label: 'Avg. Completion',
      value: formatHours(data.stats.avgCompletionHours),
      icon: TrendingUp,
      color: 'text-purple-600',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      change: null,
    },
  ] : [];

  const quickActions = [
    { label: 'New Document', icon: Plus, color: 'bg-emerald-500', action: () => router.push('/') },
    { label: 'Upload File', icon: Upload, color: 'bg-blue-500', action: () => router.push('/') },
    { label: 'Templates', icon: FileText, color: 'bg-purple-500', action: () => router.push('/') },
    { label: 'Workflows', icon: Workflow, color: 'bg-amber-500', action: () => router.push('/workflows') },
    { label: 'Settings', icon: Settings, color: 'bg-slate-500', action: () => router.push('/settings') },
    { label: 'Team', icon: Users, color: 'bg-cyan-500', action: () => router.push('/') },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 64 : 240 }}
        className="flex-shrink-0 border-r bg-card/50 backdrop-blur-sm flex flex-col transition-all duration-300"
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="font-bold text-sm whitespace-nowrap overflow-hidden"
                >
                  OpenSignature
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'documents') router.push('/');
                else if (item.id === 'workflows') router.push('/workflows');
                else if (item.id === 'settings') router.push('/settings');
                else setActiveNav(item.id);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeNav === item.id
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          ))}
        </nav>

        {/* Collapse Toggle */}
        <div className="p-2 border-t">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <ChevronRight className={`w-4 h-4 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 flex items-center justify-between px-6 border-b bg-card/50 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">Dashboard</h1>
            <Badge variant="secondary" className="text-xs">
              <Building2 className="w-3 h-3 mr-1" />
              Personal
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchDashboard}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Bell className="w-4 h-4" />
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <Button size="sm" className="gradient-primary text-white gap-1.5" onClick={() => router.push('/')}>
              <Plus className="w-3.5 h-3.5" />
              New Document
            </Button>
          </div>
        </header>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {loading && !data ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-5">
                      <div className="h-20 bg-muted rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : data && (
              <>
                {/* Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {statCards.map((stat, i) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Card className="hover:shadow-md transition-shadow group">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">{stat.label}</p>
                              <p className="text-2xl font-bold mt-1">{stat.value}</p>
                              {stat.change !== null && (
                                <div className={`flex items-center gap-1 mt-1 text-xs ${stat.positive ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {stat.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                  <span>{stat.change}%</span>
                                  <span className="text-muted-foreground">{stat.changeLabel}</span>
                                </div>
                              )}
                            </div>
                            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                              <stat.icon className={`w-5 h-5 ${stat.color}`} />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Document Trends - Area Chart */}
                  <Card className="lg:col-span-2">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">Document Trends</CardTitle>
                        <span className="text-xs text-muted-foreground">Last 30 days</span>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <ChartContainer config={trendChartConfig} className="h-[240px] w-full">
                        <AreaChart data={data.trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="fillCreated" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--color-created)" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="var(--color-created)" stopOpacity={0.05} />
                            </linearGradient>
                            <linearGradient id="fillCompleted" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--color-completed)" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="var(--color-completed)" stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                          <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            tickFormatter={(v) => formatDate(v)}
                            interval={6}
                            fontSize={11}
                          />
                          <YAxis tickLine={false} axisLine={false} tickMargin={4} fontSize={11} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Area
                            type="monotone"
                            dataKey="created"
                            stroke="var(--color-created)"
                            fill="url(#fillCreated)"
                            strokeWidth={2}
                          />
                          <Area
                            type="monotone"
                            dataKey="completed"
                            stroke="var(--color-completed)"
                            fill="url(#fillCompleted)"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  {/* Status Distribution - Donut Chart */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Status Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <ChartContainer config={statusChartConfig} className="h-[200px] w-full">
                        <PieChart>
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Pie
                            data={data.statusDistribution}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            strokeWidth={2}
                            stroke="hsl(var(--background))"
                          >
                            {data.statusDistribution.map((entry, idx) => (
                              <Cell key={idx} fill={entry.fill} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ChartContainer>
                      <div className="flex flex-wrap gap-3 mt-2 justify-center">
                        {data.statusDistribution.map(s => (
                          <div key={s.name} className="flex items-center gap-1.5 text-xs">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.fill }} />
                            <span className="text-muted-foreground">{s.name}</span>
                            <span className="font-medium">{s.value}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Weekly Activity Bar Chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">Weekly Activity</CardTitle>
                      <span className="text-xs text-muted-foreground">Last 8 weeks</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={weeklyChartConfig} className="h-[200px] w-full">
                      <BarChart data={data.weeklyActivity} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                        <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                        <YAxis tickLine={false} axisLine={false} tickMargin={4} fontSize={11} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="created" fill="var(--color-created)" radius={[4, 4, 0, 0]} barSize={16} />
                        <Bar dataKey="completed" fill="var(--color-completed)" radius={[4, 4, 0, 0]} barSize={16} />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                {/* Quick Actions + Recent Documents */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Quick Actions */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-2">
                        {quickActions.map(action => (
                          <button
                            key={action.label}
                            onClick={action.action}
                            className="flex flex-col items-center gap-2 p-3 rounded-xl border hover:bg-muted/50 transition-colors group"
                          >
                            <div className={`w-10 h-10 rounded-xl ${action.color} flex items-center justify-center text-white group-hover:scale-110 transition-transform`}>
                              <action.icon className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-medium text-center">{action.label}</span>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recent Documents */}
                  <Card className="lg:col-span-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">Recent Documents</CardTitle>
                        <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => router.push('/')}>
                          View All <ArrowUpRight className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {data.recentDocuments.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No documents yet</p>
                            <Button size="sm" className="mt-3 gradient-primary text-white gap-1" onClick={() => router.push('/')}>
                              <Plus className="w-3 h-3" /> Create First Document
                            </Button>
                          </div>
                        ) : (
                          data.recentDocuments.map((doc, i) => (
                            <motion.div
                              key={doc.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.03 }}
                              className="flex items-center gap-3 p-2.5 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer group"
                              onClick={() => router.push('/')}
                            >
                              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                <File className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate group-hover:text-emerald-600 transition-colors">{doc.title}</p>
                                <p className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {doc.signerCount > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {doc.signedCount}/{doc.signerCount}
                                  </span>
                                )}
                                <Badge className={`text-[10px] px-1.5 py-0 ${statusColors[doc.status] || statusColors.Draft}`}>
                                  {doc.status}
                                </Badge>
                              </div>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
