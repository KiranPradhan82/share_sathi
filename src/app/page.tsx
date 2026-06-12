// Share Sathi - NEPSE Market Automation Dashboard
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Settings,
  Activity,
  Send,
  RefreshCw,
  Zap,
  DollarSign,
  CheckCircle2,
  Wifi,
  WifiOff,
  Database,
  Trash2,
  Eye,
  Download,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Sprout,
  Image as ImageIcon,
  Type,
  Loader2,
} from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ---- Types ----
interface MarketData {
  id: string;
  tradingDate: string;
  nepseIndex: number;
  change: number;
  changePercentage: number;
  turnover: number;
  volume: number;
  trades: number;
  gainers: number;
  losers: number;
  unchanged: number;
  rawData: string;
  status: string;
  createdAt: string;
  posts?: FacebookPost[];
}

interface FacebookPost {
  id: string;
  marketDataId: string;
  facebookPostId: string | null;
  message: string;
  status: string;
  scheduledTime: string;
  postedTime: string | null;
  attemptCount: number;
  errorMessage: string | null;
  createdAt: string;
  marketData?: { tradingDate: string };
}

interface SystemEvent {
  id: string;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  description: string;
  metadata: string;
  severity: string;
  createdAt: string;
}

interface SystemStatus {
  status: string;
  lastFetch: string | null;
  lastFetchDate: string | null;
  lastPost: string | null;
  totalPosts: number;
  successPosts: number;
  failedPosts: number;
  successRate: number;
  recentEvents: Array<{
    eventType: string;
    description: string;
    severity: string;
    createdAt: string;
  }>;
  configuration: {
    facebookConfigured: boolean;
    autoPostEnabled: boolean;
    postTime: string;
    language: string;
  };
}

// ---- Helpers ----
function formatNpr(amount: number): string {
  if (amount >= 100000000000) {
    return `NPR ${(amount / 100000000000).toFixed(2)} Kharab`;
  }
  if (amount >= 1000000000) {
    return `NPR ${(amount / 1000000000).toFixed(2)} Arba`;
  }
  if (amount >= 10000000) {
    return `NPR ${(amount / 10000000).toFixed(2)} Crore`;
  }
  if (amount >= 100000) {
    return `NPR ${(amount / 100000).toFixed(2)} Lakhs`;
  }
  return `NPR ${amount.toLocaleString('en-US')}`;
}

function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'success': return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20';
    case 'error': return 'bg-red-500/15 text-red-500 border-red-500/20';
    case 'warning': return 'bg-yellow-500/15 text-yellow-500 border-yellow-500/20';
    case 'info': return 'bg-sky-500/15 text-sky-500 border-sky-500/20';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

function statusBadge(status: string) {
  switch (status) {
    case 'success': return <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20">Success</Badge>;
    case 'failed': return <Badge className="bg-red-500/15 text-red-500 border-red-500/20 hover:bg-red-500/20">Failed</Badge>;
    case 'posting': return <Badge className="bg-yellow-500/15 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/20">Posting</Badge>;
    case 'pending': return <Badge className="bg-muted text-muted-foreground hover:bg-muted/80">Pending</Badge>;
    case 'completed': return <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20">Completed</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

// ---- Component ----
export default function HomePage() {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Dashboard state
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [latestData, setLatestData] = useState<MarketData | null>(null);
  const [recentEvents, setRecentEvents] = useState<SystemEvent[]>([]);
  const [isLoadingPipeline, setIsLoadingPipeline] = useState(false);
  const [previewData, setPreviewData] = useState<{ marketData: MarketData; message: string; source: string; isMock?: boolean } | null>(null);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  // Market data state
  const [marketDataList, setMarketDataList] = useState<MarketData[]>([]);
  const [marketPage, setMarketPage] = useState(1);
  const [marketTotalPages, setMarketTotalPages] = useState(1);
  const [isLoadingMarket, setIsLoadingMarket] = useState(false);

  // Posts state
  const [postsList, setPostsList] = useState<FacebookPost[]>([]);
  const [postsPage, setPostsPage] = useState(1);
  const [postsTotalPages, setPostsTotalPages] = useState(1);
  const [postFilter, setPostFilter] = useState('all');
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [selectedPost, setSelectedPost] = useState<FacebookPost | null>(null);

  // Logs state
  const [logsList, setLogsList] = useState<SystemEvent[]>([]);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logsSeverityFilter, setLogsSeverityFilter] = useState('all');
  const [logsTypeFilter, setLogsTypeFilter] = useState('all');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Settings state
  const [settings, setSettings] = useState<Record<string, string>>({
    facebook_app_id: '',
    facebook_app_secret: '',
    facebook_page_id: '',
    facebook_page_access_token: '',
    auto_post_enabled: 'false',
    post_time: '15:00',
    notification_email: '',
    language: 'en',
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [connectionTest, setConnectionTest] = useState<{ testing: boolean; result: string | null }>({
    testing: false,
    result: null,
  });

  // Image post state
  const [postMode, setPostMode] = useState<'text' | 'image'>('image');
  const [imagePreview, setImagePreview] = useState<{
    marketSummary: string;
    topGainers: string;
    topLosers: string;
  } | null>(null);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);

  // Loading states
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);

  // ---- Fetch functions ----
  const fetchSystemStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/system/status');
      if (res.ok) {
        const json = await res.json();
        setSystemStatus(json);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  const fetchLatestData = useCallback(async () => {
    try {
      const res = await fetch('/api/market-data/latest');
      if (res.ok) {
        const json = await res.json();
        setLatestData(json.data);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchRecentEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/system/logs?page=1&limit=8');
      if (res.ok) {
        const json = await res.json();
        setRecentEvents(json.data);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchMarketData = useCallback(async (page: number) => {
    setIsLoadingMarket(true);
    try {
      const res = await fetch(`/api/market-data?page=${page}&limit=15`);
      if (res.ok) {
        const json = await res.json();
        setMarketDataList(json.data);
        setMarketTotalPages(json.pagination.totalPages);
      }
    } catch {
      toast.error('Failed to fetch market data');
    } finally {
      setIsLoadingMarket(false);
    }
  }, []);

  const fetchPosts = useCallback(async (page: number, status: string) => {
    setIsLoadingPosts(true);
    try {
      const res = await fetch(`/api/posts?page=${page}&limit=15&status=${status}`);
      if (res.ok) {
        const json = await res.json();
        setPostsList(json.data);
        setPostsTotalPages(json.pagination.totalPages);
      }
    } catch {
      toast.error('Failed to fetch posts');
    } finally {
      setIsLoadingPosts(false);
    }
  }, []);

  const fetchLogs = useCallback(async (page: number, severity: string, eventType: string) => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch(`/api/system/logs?page=${page}&limit=20&severity=${severity}&eventType=${eventType}`);
      if (res.ok) {
        const json = await res.json();
        setLogsList(json.data);
        setLogsTotalPages(json.pagination.totalPages);
      }
    } catch {
      toast.error('Failed to fetch logs');
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const json = await res.json();
        setSettings(json.data);
      }
    } catch {
      // ignore
    }
  }, []);

  // ---- Initial load ----
  useEffect(() => {
    fetchSystemStatus();
    fetchLatestData();
    fetchRecentEvents();
    fetchMarketData(1);
    fetchPosts(1, 'all');
    fetchLogs(1, 'all', 'all');
    fetchSettings();
  }, [fetchSystemStatus, fetchLatestData, fetchRecentEvents, fetchMarketData, fetchPosts, fetchLogs, fetchSettings]);

  // ---- Actions ----
  const handleFetchPreview = async () => {
    setPreviewData(null);
    setIsFetchingPreview(true);
    try {
      const res = await fetch('/api/posts/preview', { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.success) {
        setPreviewData({
          marketData: json.marketData,
          message: json.previewMessage,
          source: json.source,
          isMock: json.isMock,
        });
        if (json.isMock) {
          toast.warning('WARNING: Using MOCK data! Real NEPSE data could not be fetched.');
        } else {
          toast.success('Real NEPSE data fetched! Review the preview below.');
        }
        fetchSystemStatus();
        fetchLatestData();
        fetchMarketData(1);
      } else {
        toast.error(json.error || 'Failed to fetch data');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsFetchingPreview(false);
    }
  };

  const handleConfirmPost = async () => {
    if (!previewData) return;
    setIsPosting(true);
    try {
      const res = await fetch('/api/posts/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: previewData.marketData.tradingDate, mode: 'text' }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success('Posted to Facebook successfully!');
        setPreviewData(null);
        fetchSystemStatus();
        fetchLatestData();
        fetchRecentEvents();
        fetchPosts(1, 'all');
      } else {
        toast.error(json.error || json.message || 'Failed to post');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  const handleCancelPreview = () => {
    setPreviewData(null);
  };

  const handleFetchLatest = async () => {
    try {
      const res = await fetch('/api/market-data/fetch', { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        toast.success('Market data fetched!');
        fetchMarketData(1);
        fetchLatestData();
        fetchSystemStatus();
      } else {
        toast.error(json.error || 'Fetch failed');
      }
    } catch {
      toast.error('Failed to fetch market data');
    }
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        toast.success(json.message || 'Database seeded!');
        fetchSystemStatus();
        fetchLatestData();
        fetchRecentEvents();
        fetchMarketData(1);
        fetchPosts(1, 'all');
      } else {
        toast.error(json.error || 'Seed failed');
      }
    } catch {
      toast.error('Failed to seed database');
    } finally {
      setIsSeeding(false);
    }
  };

  const [savingSection, setSavingSection] = useState<string | null>(null);

  const handleSaveSection = async (keys: string[], sectionName: string) => {
    setSavingSection(sectionName);
    try {
      const sectionSettings: Record<string, string> = {};
      for (const key of keys) {
        sectionSettings[key] = settings[key];
      }
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: sectionSettings }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(`${sectionName} saved!`);
        fetchSystemStatus();
      } else {
        toast.error(json.error || 'Failed to save');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSavingSection(null);
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success('All settings saved!');
        fetchSystemStatus();
      } else {
        toast.error(json.error || 'Failed to save');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleTestConnection = async () => {
    if (!settings.facebook_page_id || !settings.facebook_page_access_token) {
      setConnectionTest({ testing: false, result: 'Please enter Page ID and Access Token first' });
      toast.error('Please enter Page ID and Access Token first');
      return;
    }

    setConnectionTest({ testing: true, result: null });
    try {
      const res = await fetch('/api/facebook/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: settings.facebook_page_id,
          pageAccessToken: settings.facebook_page_access_token,
          appId: settings.facebook_app_id,
          appSecret: settings.facebook_app_secret,
        }),
      });

      const data = await res.json();

      if (data.success) {
        const pageName = data.pageName ? ` (${data.pageName})` : '';
        setConnectionTest({ testing: false, result: `Connection successful!${pageName}` });
        toast.success(`Connected to Facebook Page${pageName}`);
      } else {
        setConnectionTest({ testing: false, result: `Failed: ${data.error || 'Unknown error'}` });
        toast.error(data.error || 'Connection test failed');
      }
    } catch {
      setConnectionTest({ testing: false, result: 'Connection test failed — network error' });
      toast.error('Connection test failed — check your network');
    }
  };

  const handleClearLogs = async () => {
    try {
      const res = await fetch('/api/system/logs', { method: 'DELETE' });
      if (res.ok) {
        toast.success('Logs cleared');
        fetchLogs(1, 'all', 'all');
        fetchRecentEvents();
      }
    } catch {
      toast.error('Failed to clear logs');
    }
  };

  // ---- Image Actions ----
  const handleGenerateImages = async () => {
    setImagePreview(null);
    setIsGeneratingImages(true);
    try {
      const res = await fetch('/api/posts/generate-images', { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.success) {
        setImagePreview(json.images);
        toast.success('3 post images generated! Review them below.');
        fetchSystemStatus();
        fetchLatestData();
        fetchMarketData(1);
      } else {
        toast.error(json.error || 'Failed to generate images');
      }
    } catch {
      toast.error('Network error generating images');
    } finally {
      setIsGeneratingImages(false);
    }
  };

  const handlePostImages = async () => {
    if (!imagePreview) return;
    setIsPosting(true);
    try {
      const res = await fetch('/api/posts/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'image' }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        const postCount = json.posts?.length || 3;
        const successCount = json.posts?.filter((p: { success: boolean }) => p.success).length || 0;
        toast.success(`Posted ${successCount}/${postCount} images to Facebook!`);
        setImagePreview(null);
        fetchSystemStatus();
        fetchLatestData();
        fetchRecentEvents();
        fetchPosts(1, 'all');
      } else {
        toast.error(json.error || json.message || 'Failed to post images');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  const handlePostTextMode = async () => {
    if (!previewData) return;
    setIsPosting(true);
    try {
      const res = await fetch('/api/posts/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: previewData.marketData.tradingDate, mode: 'text' }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success('Posted to Facebook successfully!');
        setPreviewData(null);
        fetchSystemStatus();
        fetchLatestData();
        fetchRecentEvents();
        fetchPosts(1, 'all');
      } else {
        toast.error(json.error || json.message || 'Failed to post');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  // ---- Render helpers ----
  const renderSkeletonCards = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-32 mb-1" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  // ---- Dashboard Tab ----
  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground text-sm">NEPSE market automation overview</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Post Mode Selector */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setPostMode('image')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                postMode === 'image'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Image
            </button>
            <button
              onClick={() => setPostMode('text')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                postMode === 'text'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              <Type className="h-3.5 w-3.5" />
              Text
            </button>
          </div>

          {postMode === 'image' ? (
            <>
              {!imagePreview ? (
                <Button
                  onClick={handleGenerateImages}
                  disabled={isGeneratingImages}
                  size="lg"
                  className="gap-2"
                >
                  {isGeneratingImages ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImageIcon className="h-4 w-4" />
                  )}
                  {isGeneratingImages ? 'Generating...' : 'Generate Images'}
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handlePostImages}
                    disabled={isPosting}
                    size="lg"
                    className="gap-2"
                  >
                    {isPosting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {isPosting ? 'Posting 3 Images...' : 'Post 3 Images'}
                  </Button>
                  <Button
                    onClick={() => setImagePreview(null)}
                    variant="outline"
                    size="lg"
                    className="gap-2"
                  >
                    Cancel
                  </Button>
                </>
              )}
            </>
          ) : (
            <>
              {!previewData ? (
                <Button
                  onClick={handleFetchPreview}
                  disabled={isFetchingPreview}
                  size="lg"
                  className="gap-2"
                >
                  {isFetchingPreview ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {isFetchingPreview ? 'Fetching...' : 'Fetch & Preview'}
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handlePostTextMode}
                    disabled={isPosting}
                    size="lg"
                    className="gap-2"
                  >
                    {isPosting ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {isPosting ? 'Posting...' : 'Confirm & Post'}
                  </Button>
                  <Button
                    onClick={handleCancelPreview}
                    variant="outline"
                    size="lg"
                    className="gap-2"
                  >
                    Cancel
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Image Preview Grid */}
      {imagePreview && (
        <div className="space-y-4">
          <Card className="border-emerald-500/50 bg-emerald-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-emerald-500" />
                Image Post Preview
              </CardTitle>
              <CardDescription>3 images will be posted to Facebook: Market Summary, Top 10 Gainers, Top 10 Losers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">1. Market Summary</p>
                  <div className="rounded-lg overflow-hidden border border-border bg-muted">
                    <img src={imagePreview.marketSummary} alt="Market Summary" className="w-full h-auto" />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">2. Top 10 Gainers</p>
                  <div className="rounded-lg overflow-hidden border border-border bg-muted">
                    <img src={imagePreview.topGainers} alt="Top 10 Gainers" className="w-full h-auto" />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">3. Top 10 Losers</p>
                  <div className="rounded-lg overflow-hidden border border-border bg-muted">
                    <img src={imagePreview.topLosers} alt="Top 10 Losers" className="w-full h-auto" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Text Preview Card (text mode only) */}
      {postMode === 'text' && previewData && (
        <Card className="border-blue-500/50 bg-blue-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Eye className="h-4 w-4 text-blue-500" />
                  Post Preview
                </CardTitle>
                <CardDescription className="mt-1">
                  Data source: <span className={previewData.isMock ? 'text-red-500 font-semibold' : 'text-emerald-500 font-medium'}>{previewData.source}</span> | Date: {previewData.marketData.tradingDate}
                </CardDescription>
              </div>
              <div className="text-right text-sm">
                <div className={`font-bold text-lg ${previewData.marketData.change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {previewData.marketData.change >= 0 ? '+' : ''}{previewData.marketData.nepseIndex.toFixed(2)}
                </div>
                <div className={`text-xs ${previewData.marketData.change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {previewData.marketData.change >= 0 ? '▲' : '▼'} {previewData.marketData.change >= 0 ? '+' : ''}{previewData.marketData.changePercentage.toFixed(2)}%
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {previewData.isMock && (
              <div className="mb-3 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-500 flex items-center gap-2">
                <WifiOff className="h-4 w-4 shrink-0" />
                This is <strong>MOCK data</strong>, not real NEPSE data. The website scraping failed. Do NOT post this.
              </div>
            )}
            <div className="rounded-lg bg-muted p-4 text-sm whitespace-pre-line font-mono leading-relaxed">
              {previewData.message}
            </div>
          </CardContent>
        </Card>
      )}

      {isLoadingStatus ? (
        renderSkeletonCards()
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* NEPSE Index Card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                <BarChart3 className="h-3.5 w-3.5" />
                NEPSE Index
              </div>
              {latestData ? (
                <>
                  <div className="text-2xl font-bold">
                    {latestData.nepseIndex.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-medium ${latestData.change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {latestData.change >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {latestData.change >= 0 ? '+' : ''}{latestData.change.toFixed(2)} ({latestData.changePercentage >= 0 ? '+' : ''}{latestData.changePercentage}%)
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground text-sm">No data</div>
              )}
            </CardContent>
          </Card>

          {/* Turnover Card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                <DollarSign className="h-3.5 w-3.5" />
                Today&apos;s Turnover
              </div>
              {latestData ? (
                <>
                  <div className="text-2xl font-bold">{formatNpr(latestData.turnover)}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatNumber(latestData.trades)} trades
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground text-sm">No data</div>
              )}
            </CardContent>
          </Card>

          {/* Total Posts Card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                <Send className="h-3.5 w-3.5" />
                Total Posts
              </div>
              <div className="text-2xl font-bold">{systemStatus?.totalPosts ?? 0}</div>
              <div className="text-xs text-muted-foreground">
                {systemStatus?.successPosts ?? 0} successful
              </div>
            </CardContent>
          </Card>

          {/* Success Rate Card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Success Rate
              </div>
              <div className="text-2xl font-bold">{systemStatus?.successRate ?? 0}%</div>
              <Progress value={systemStatus?.successRate ?? 0} className="h-1.5 mt-1" />
            </CardContent>
          </Card>

          {/* System Status Card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                <Activity className="h-3.5 w-3.5" />
                System Status
              </div>
              <div className="flex items-center gap-2">
                {(systemStatus?.status ?? 'online') === 'online' ? (
                  <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/20">
                    <Wifi className="h-3 w-3 mr-1" /> Online
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <WifiOff className="h-3 w-3 mr-1" /> Offline
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {systemStatus?.configuration?.autoPostEnabled ? (
                  <span className="text-emerald-500">Auto-post ON</span>
                ) : (
                  <span>Auto-post OFF</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latest Market Data */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Latest Market Data</CardTitle>
            <CardDescription>Most recent NEPSE trading data</CardDescription>
          </CardHeader>
          <CardContent>
            {latestData ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Trading Date</p>
                  <p className="text-sm font-medium">{latestData.tradingDate}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">NEPSE Index</p>
                  <p className="text-sm font-medium">{latestData.nepseIndex.toFixed(2)}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Change</p>
                  <p className={`text-sm font-medium ${latestData.change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {latestData.change >= 0 ? '+' : ''}{latestData.change.toFixed(2)} ({latestData.changePercentage >= 0 ? '+' : ''}{latestData.changePercentage}%)
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Turnover</p>
                  <p className="text-sm font-medium">{formatNpr(latestData.turnover)}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Volume</p>
                  <p className="text-sm font-medium">{formatNumber(latestData.volume)} shares</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Trades</p>
                  <p className="text-sm font-medium">{formatNumber(latestData.trades)}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> Gainers
                  </p>
                  <p className="text-sm font-medium text-emerald-500">{latestData.gainers}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-red-500" /> Losers
                  </p>
                  <p className="text-sm font-medium text-red-500">{latestData.losers}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No market data available</p>
                <Button variant="outline" size="sm" onClick={handleSeed} className="mt-3 gap-1">
                  <Sprout className="h-3.5 w-3.5" /> Seed Demo Data
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
            <CardDescription>Latest system events</CardDescription>
          </CardHeader>
          <CardContent>
            {recentEvents.length > 0 ? (
              <div className="max-h-64 overflow-y-auto space-y-3">
                {recentEvents.map((event) => (
                  <div key={event.id} className="flex items-start gap-3">
                    <div className="mt-1.5">
                      <div className={`w-2 h-2 rounded-full ${
                        event.severity === 'success' ? 'bg-emerald-500' :
                        event.severity === 'error' ? 'bg-red-500' :
                        event.severity === 'warning' ? 'bg-yellow-500' :
                        'bg-sky-500'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{timeAgo(event.createdAt)}</p>
                      <p className="text-sm truncate">{event.description}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {event.eventType}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No recent activity</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // ---- Market Data Tab ----
  const renderMarketData = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Market Data</h2>
          <p className="text-muted-foreground text-sm">Historical NEPSE trading data</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleFetchLatest} size="sm" className="gap-1">
            <RefreshCw className="h-3.5 w-3.5" /> Fetch Latest
          </Button>
          <Button onClick={handleSeed} size="sm" variant="outline" className="gap-1" disabled={isSeeding}>
            {isSeeding ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sprout className="h-3.5 w-3.5" />}
            Seed Data
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoadingMarket ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : marketDataList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No market data available</p>
              <p className="text-xs mt-1">Click &quot;Seed Data&quot; to populate with demo data</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs text-right">Index</TableHead>
                    <TableHead className="text-xs text-right">Change</TableHead>
                    <TableHead className="text-xs text-right">Change %</TableHead>
                    <TableHead className="text-xs text-right hidden md:table-cell">Turnover</TableHead>
                    <TableHead className="text-xs text-right hidden lg:table-cell">Trades</TableHead>
                    <TableHead className="text-xs text-right hidden lg:table-cell">Gainers</TableHead>
                    <TableHead className="text-xs text-right hidden lg:table-cell">Losers</TableHead>
                    <TableHead className="text-xs text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marketDataList.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs font-medium">{item.tradingDate}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{item.nepseIndex.toFixed(2)}</TableCell>
                      <TableCell className={`text-xs text-right font-mono ${item.change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}
                      </TableCell>
                      <TableCell className={`text-xs text-right font-mono ${item.changePercentage >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {item.changePercentage >= 0 ? '+' : ''}{item.changePercentage}%
                      </TableCell>
                      <TableCell className="text-xs text-right hidden md:table-cell">{formatNpr(item.turnover)}</TableCell>
                      <TableCell className="text-xs text-right hidden lg:table-cell">{formatNumber(item.trades)}</TableCell>
                      <TableCell className="text-xs text-right text-emerald-500 hidden lg:table-cell">{item.gainers}</TableCell>
                      <TableCell className="text-xs text-right text-red-500 hidden lg:table-cell">{item.losers}</TableCell>
                      <TableCell className="text-xs text-center">{statusBadge(item.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {marketTotalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setMarketPage((p) => Math.max(1, p - 1)); fetchMarketData(Math.max(1, marketPage - 1)); }}
            disabled={marketPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {marketPage} of {marketTotalPages}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setMarketPage((p) => p + 1); fetchMarketData(marketPage + 1); }}
            disabled={marketPage >= marketTotalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );

  // ---- Posts Tab ----
  const renderPosts = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Post History</h2>
          <p className="text-muted-foreground text-sm">Facebook post attempts and results</p>
        </div>
        <Select value={postFilter} onValueChange={(v) => { setPostFilter(v); setPostsPage(1); fetchPosts(1, v); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoadingPosts ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : postsList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Send className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No posts yet</p>
              <p className="text-xs mt-1">Use the &quot;Fetch & Post Now&quot; button on the dashboard</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs text-center">Status</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Message Preview</TableHead>
                    <TableHead className="text-xs text-center hidden sm:table-cell">Attempts</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">Posted Time</TableHead>
                    <TableHead className="text-xs text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {postsList.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell className="text-xs font-medium">
                        {post.marketData?.tradingDate || formatDateTime(post.createdAt).split(',')[0]}
                      </TableCell>
                      <TableCell className="text-xs text-center">{statusBadge(post.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground hidden md:table-cell max-w-[200px] truncate">
                        {post.message.substring(0, 60)}...
                      </TableCell>
                      <TableCell className="text-xs text-center hidden sm:table-cell">{post.attemptCount}</TableCell>
                      <TableCell className="text-xs hidden lg:table-cell">
                        {post.postedTime ? formatDateTime(post.postedTime) : '—'}
                        {post.errorMessage && (
                          <p className="text-red-500 text-[10px] mt-0.5 truncate">{post.errorMessage}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-center">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => setSelectedPost(post)}>
                              <Eye className="h-3 w-3" /> View
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-lg">
                            <DialogHeader>
                              <DialogTitle>Post Details</DialogTitle>
                              <DialogDescription>
                                {post.marketData?.tradingDate || 'Unknown date'} — {post.status}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-3">
                              <div className="flex flex-wrap gap-2">
                                {statusBadge(post.status)}
                                <Badge variant="outline">Attempts: {post.attemptCount}</Badge>
                                {post.facebookPostId && (
                                  <Badge variant="outline">FB ID: {post.facebookPostId.substring(0, 15)}...</Badge>
                                )}
                              </div>
                              <Separator />
                              <div>
                                <p className="text-xs text-muted-foreground mb-1 font-medium">Message Content:</p>
                                <div className="bg-muted rounded-md p-3 text-xs whitespace-pre-wrap font-mono max-h-60 overflow-y-auto">
                                  {post.message}
                                </div>
                              </div>
                              {post.errorMessage && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1 font-medium">Error:</p>
                                  <div className="bg-red-500/10 rounded-md p-3 text-xs text-red-500">
                                    {post.errorMessage}
                                  </div>
                                </div>
                              )}
                              <div className="text-[10px] text-muted-foreground">
                                Scheduled: {formatDateTime(post.scheduledTime)} | Posted: {formatDateTime(post.postedTime)}
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {postsTotalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setPostsPage((p) => Math.max(1, p - 1)); fetchPosts(Math.max(1, postsPage - 1), postFilter); }}
            disabled={postsPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {postsPage} of {postsTotalPages}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setPostsPage((p) => p + 1); fetchPosts(postsPage + 1, postFilter); }}
            disabled={postsPage >= postsTotalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );

  // ---- Settings Tab ----
  const renderSettings = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground text-sm">Configure your Share Sathi automation</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Facebook Integration */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Facebook Integration</CardTitle>
            <CardDescription>Connect your Facebook page for posting</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="appId">App ID</Label>
              <Input
                id="appId"
                placeholder="e.g. 2098986594389901"
                value={settings.facebook_app_id}
                onChange={(e) => setSettings((s) => ({ ...s, facebook_app_id: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appSecret">App Secret</Label>
              <Input
                id="appSecret"
                type="password"
                placeholder="From App Dashboard → Settings → Basic"
                value={settings.facebook_app_secret}
                onChange={(e) => setSettings((s) => ({ ...s, facebook_app_secret: e.target.value }))}
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="pageId">Page ID</Label>
              <Input
                id="pageId"
                placeholder="Enter your Facebook Page ID"
                value={settings.facebook_page_id}
                onChange={(e) => setSettings((s) => ({ ...s, facebook_page_id: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accessToken">Page Access Token</Label>
              <Input
                id="accessToken"
                type="password"
                placeholder="Enter your Page Access Token"
                value={settings.facebook_page_access_token}
                onChange={(e) => setSettings((s) => ({ ...s, facebook_page_access_token: e.target.value }))}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={connectionTest.testing}
              className="gap-1"
            >
              {connectionTest.testing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wifi className="h-3.5 w-3.5" />
              )}
              Test Connection
            </Button>
            {connectionTest.result && (
              <p className={`text-xs ${connectionTest.result.includes('success') || connectionTest.result.includes('Successful') ? 'text-emerald-500' : 'text-red-500'}`}>
                {connectionTest.result}
              </p>
            )}
            <Separator />
            <Button
              onClick={() => handleSaveSection(
                ['facebook_app_id', 'facebook_app_secret', 'facebook_page_id', 'facebook_page_access_token'],
                'Facebook Integration'
              )}
              disabled={savingSection === 'Facebook Integration'}
              size="sm"
              className="w-full gap-1"
            >
              {savingSection === 'Facebook Integration' ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {savingSection === 'Facebook Integration' ? 'Saving...' : 'Save Facebook Settings'}
            </Button>
          </CardContent>
        </Card>

        {/* Automation */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Automation</CardTitle>
            <CardDescription>Configure auto-posting behavior</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-Post Enabled</Label>
                <p className="text-xs text-muted-foreground">Automatically post after market close</p>
              </div>
              <Switch
                checked={settings.auto_post_enabled === 'true'}
                onCheckedChange={(checked) =>
                  setSettings((s) => ({ ...s, auto_post_enabled: String(checked) }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postTime">Post Time</Label>
              <Input
                id="postTime"
                type="time"
                value={settings.post_time}
                onChange={(e) => setSettings((s) => ({ ...s, post_time: e.target.value }))}
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="notifEmail">Notification Email</Label>
              <Input
                id="notifEmail"
                type="email"
                placeholder="alerts@example.com"
                value={settings.notification_email}
                onChange={(e) => setSettings((s) => ({ ...s, notification_email: e.target.value }))}
              />
            </div>
            <Separator />
            <Button
              onClick={() => handleSaveSection(
                ['auto_post_enabled', 'post_time', 'notification_email'],
                'Automation'
              )}
              disabled={savingSection === 'Automation'}
              size="sm"
              className="w-full gap-1"
            >
              {savingSection === 'Automation' ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {savingSection === 'Automation' ? 'Saving...' : 'Save Automation Settings'}
            </Button>
          </CardContent>
        </Card>

        {/* Content Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Content</CardTitle>
            <CardDescription>Configure post content and language</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Language</Label>
              <Select
                value={settings.language}
                onValueChange={(v) => setSettings((s) => ({ ...s, language: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ne">Nepali</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Post Template Preview</Label>
              <Textarea
                readOnly
                value={`📈 NEPSE Daily Market Update\n📅 Date: {tradingDate}\n\n🏛️ NEPSE Index: {nepseIndex} ({arrow} {change} | {changePercentage}%)\n💰 Total Turnover: NPR {turnover}\n📊 Total Trades: {trades}\n📦 Volume: {volume} shares\n\n🟢 Gainers: {gainers} | 🔴 Losers: {losers} | ⚪ Unchanged: {unchanged}\n\n#NEPSE #NepalStockExchange #ShareMarket #ShareSathi`}
                className="min-h-[140px] text-xs font-mono"
              />
            </div>
            <Separator />
            <Button
              onClick={() => handleSaveSection(['language'], 'Content')}
              disabled={savingSection === 'Content'}
              size="sm"
              className="w-full gap-1"
            >
              {savingSection === 'Content' ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {savingSection === 'Content' ? 'Saving...' : 'Save Content Settings'}
            </Button>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Actions</CardTitle>
            <CardDescription>System maintenance operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleSaveSettings} disabled={isSavingSettings} className="w-full gap-1">
              {isSavingSettings ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {isSavingSettings ? 'Saving All...' : 'Save All Settings'}
            </Button>
            <Separator />
            <Button onClick={handleSeed} disabled={isSeeding} variant="outline" className="w-full gap-1">
              {isSeeding ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Database className="h-4 w-4" />
              )}
              {isSeeding ? 'Seeding...' : 'Seed Demo Data'}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              Seeding will populate the database with 30 days of demo data
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // ---- Logs Tab ----
  const renderLogs = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System Logs</h2>
          <p className="text-muted-foreground text-sm">System events and activity log</p>
        </div>
        <div className="flex gap-2">
          <Select value={logsSeverityFilter} onValueChange={(v) => { setLogsSeverityFilter(v); setLogsPage(1); fetchLogs(1, v, logsTypeFilter); }}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
          <Select value={logsTypeFilter} onValueChange={(v) => { setLogsTypeFilter(v); setLogsPage(1); fetchLogs(1, logsSeverityFilter, v); }}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="fetch">Fetch</SelectItem>
              <SelectItem value="post">Post</SelectItem>
              <SelectItem value="config">Config</SelectItem>
              <SelectItem value="pipeline">Pipeline</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="destructive" size="sm" onClick={handleClearLogs} className="gap-1">
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoadingLogs ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logsList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No logs yet</p>
            </div>
          ) : (
            <div className="max-h-[480px] overflow-y-auto divide-y divide-border">
              {logsList.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors">
                  <div className="mt-1">
                    <Badge variant="outline" className={`text-[10px] ${severityColor(log.severity)}`}>
                      {log.severity}
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant="outline" className="text-[10px]">{log.eventType}</Badge>
                      {log.entityType && (
                        <span className="text-[10px] text-muted-foreground">{log.entityType}</span>
                      )}
                    </div>
                    <p className="text-sm">{log.description}</p>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {formatDateTime(log.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {logsTotalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setLogsPage((p) => Math.max(1, p - 1)); fetchLogs(Math.max(1, logsPage - 1), logsSeverityFilter, logsTypeFilter); }}
            disabled={logsPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {logsPage} of {logsTotalPages}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setLogsPage((p) => p + 1); fetchLogs(logsPage + 1, logsSeverityFilter, logsTypeFilter); }}
            disabled={logsPage >= logsTotalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="Share Sathi"
              className="h-8 w-8 rounded-lg object-cover"
            />
            <div>
              <h1 className="text-base font-bold leading-none">Share Sathi</h1>
              <p className="text-[10px] text-muted-foreground leading-none">NEPSE Market Automation</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 container mx-auto px-4 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="dashboard" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="market" className="gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Market</span>
            </TabsTrigger>
            <TabsTrigger value="posts" className="gap-1.5">
              <Send className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Posts</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logs</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">{renderDashboard()}</TabsContent>
          <TabsContent value="market">{renderMarketData()}</TabsContent>
          <TabsContent value="posts">{renderPosts()}</TabsContent>
          <TabsContent value="settings">{renderSettings()}</TabsContent>
          <TabsContent value="logs">{renderLogs()}</TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-1">
          <p className="text-xs text-muted-foreground">© 2026 Share Sathi — Built for Kiran Pradhan</p>
          <p className="text-xs text-muted-foreground">NEPSE Market Automation • 100% Free</p>
        </div>
      </footer>
    </div>
  );
}