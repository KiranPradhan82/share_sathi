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
  Image as ImageIcon,
  Type,
  Loader2,
  LogOut,
  Newspaper,
  Film,
  Upload,
  X,
  Rss,
  Clock,
  FileText,
  ExternalLink,
  Trophy,
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

import { generateImagesInBrowser, generateIpoCardImage, generateIpoStoryImage, generateMarketStoryFromImage, generateIpoResultCardImage, generateIpoResultStoryImage, generateNewsCardImage, type IpoCardData } from '@/lib/client-image-generator';
import { parseStockDataFromRawData } from '@/lib/nepse';
import type { StockData } from '@/lib/nepse';

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

  // ---- 5-minute inactivity timeout ----
  const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 minutes
  const WARNING_BEFORE = 30 * 1000; // warn 30s before expiry
  let lastActivity = Date.now();
  let warningShown = false;

  useEffect(() => {
    const resetTimer = () => {
      lastActivity = Date.now();
      warningShown = false;
    };

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(evt => window.addEventListener(evt, resetTimer, { passive: true }));

    const checkInterval = setInterval(() => {
      const elapsed = Date.now() - lastActivity;
      const remaining = INACTIVITY_LIMIT - elapsed;

      if (remaining <= 0) {
        // Session expired — logout and redirect
        clearInterval(checkInterval);
        fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
          window.location.href = '/auth/login';
        });
      } else if (remaining <= WARNING_BEFORE && !warningShown) {
        // Show warning
        warningShown = true;
        const secs = Math.ceil(remaining / 1000);
        toast.warning(`Session expires in ${secs}s due to inactivity`, {
          duration: (secs - 1) * 1000,
          id: 'inactivity-warning',
        });
      }
    }, 5000); // check every 5 seconds

    return () => {
      clearInterval(checkInterval);
      activityEvents.forEach(evt => window.removeEventListener(evt, resetTimer));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [activeTab, setActiveTab] = useState('dashboard');

  // Dashboard state
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [latestData, setLatestData] = useState<MarketData | null>(null);
  const [recentEvents, setRecentEvents] = useState<SystemEvent[]>([]);
  const [isLoadingPipeline, setIsLoadingPipeline] = useState(false);
  const [previewData, setPreviewData] = useState<{ marketData: MarketData; message: string; source: string } | null>(null);
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

  // Error detail dialog
  const [errorDialogTitle, setErrorDialogTitle] = useState('');
  const [errorDetailText, setErrorDetailText] = useState('');
  const [showErrorDialog, setShowErrorDialog] = useState(false);

  // Settings state
  const [settings, setSettings] = useState<Record<string, string>>({
    facebook_app_id: '',
    facebook_app_secret: '',
    facebook_page_id: '',
    facebook_page_access_token: '',
    auto_post_enabled: 'false',
    post_time: '15:00',
    refetch_interval_minutes: '5',
    off_days: '0,6',
    hashtags: '',
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
    stockCards: Array<{
      type: 'gainer' | 'loser';
      rank: number;
      symbol: string;
      name: string;
      image: string;
    }>;
  } | null>(null);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [postingCardIndex, setPostingCardIndex] = useState<number | null>(null);
  const [postedCardIndices, setPostedCardIndices] = useState<Set<number>>(new Set());
  const [summaryPosted, setSummaryPosted] = useState(false);

  // IPO state
  const [ipoData, setIpoData] = useState<Array<{
    companyName: string; companySymbol: string; ipoType: string; issueManager: string;
    issuedUnits: number; numberOfApplications: number; appliedUnits: number;
    totalAmount: number; openDate: string; closeDate: string; lastUpdate: string;
    oversubscription: number | null;
  }> | null>(null);
  const [isFetchingIpo, setIsFetchingIpo] = useState(false);
  const [ipoCardImages, setIpoCardImages] = useState<Array<{ image: string; data: IpoCardData }>>([]);
  const [isGeneratingIpoImages, setIsGeneratingIpoImages] = useState(false);
  const [postingIpoIndex, setPostingIpoIndex] = useState<number | null>(null);

  // Upcoming IPO + SEBON pipeline state
  const [upcomingIpoData, setUpcomingIpoData] = useState<Array<{
    id: number; symbol: string; companyName: string; sector: string;
    units: number; totalAmount: number; applicationDate: string;
    sebonDate: string; issueManager: string; shareType: string;
  }> | null>(null);
  const [sebonPipelineData, setSebonPipelineData] = useState<Array<{
    title: string; date: string; englishUrl: string; nepaliUrl: string;
  }> | null>(null);
  const [ipoActiveTab, setIpoActiveTab] = useState<'cdsc' | 'upcoming' | 'sebon' | 'results'>('cdsc');

  // IPO Result state
  const [ipoResultNews, setIpoResultNews] = useState<Array<{
    id: string; externalId: string; source: string; headline: string; summary: string;
    category: string; language: string; publishedAt: string; fetchedAt: string;
    isPosted: boolean; postedAt: string | null;
  }>>([]);
  const [isFetchingIpoResultNews, setIsFetchingIpoResultNews] = useState(false);
  const [isLoadingIpoResultNews, setIsLoadingIpoResultNews] = useState(false);
  const [postingIpoResultNewsId, setPostingIpoResultNewsId] = useState<string | null>(null);
  const [ipoResultCardImages, setIpoResultCardImages] = useState<Array<{ image: string; data: IpoCardData }>>([]);
  const [isGeneratingIpoResultImages, setIsGeneratingIpoResultImages] = useState(false);
  const [postingIpoResultCardIdx, setPostingIpoResultCardIdx] = useState<number | null>(null);
  const [postingIpoResultStoryIdx, setPostingIpoResultStoryIdx] = useState<number | null>(null);
  const [postedIpoResultStoryIdxs, setPostedIpoResultStoryIdxs] = useState<Set<number>>(new Set());

  // Story state
  const [postingStoryIndex, setPostingStoryIndex] = useState<number | null>(null);
  const [postedStoryIndices, setPostedStoryIndices] = useState<Set<number>>(new Set());

  // Reel state
  const [reelFile, setReelFile] = useState<File | null>(null);
  const [reelCaption, setReelCaption] = useState('');
  const [reelPreviewUrl, setReelPreviewUrl] = useState<string | null>(null);
  const [isPostingReel, setIsPostingReel] = useState(false);

  // News state
  const [newsItems, setNewsItems] = useState<Array<{
    id: string; externalId: string; source: string; headline: string; summary: string;
    category: string; language: string; publishedAt: string; fetchedAt: string;
    isPosted: boolean; postedAt: string | null;
  }>>([]);
  const [newsPage, setNewsPage] = useState(1);
  const [newsTotalPages, setNewsTotalPages] = useState(1);
  const [newsFilter, setNewsFilter] = useState('all');
  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const [isFetchingNews, setIsFetchingNews] = useState(false);
  const [postingNewsId, setPostingNewsId] = useState<string | null>(null);
  const [deletingNewsId, setDeletingNewsId] = useState<string | null>(null);
  const [postedNewsIds, setPostedNewsIds] = useState<Set<string>>(new Set());

  // News card image state
  const [newsCardImages, setNewsCardImages] = useState<Array<{ image: string; data: { headline: string; summary: string; source: string; category: string; publishedAt: string; language: string; newsId: string } }>>([]);
  const [isGeneratingNewsImages, setIsGeneratingNewsImages] = useState(false);
  const [postingNewsCardIdx, setPostingNewsCardIdx] = useState<number | null>(null);

  // Market story state
  const [postingMarketStory, setPostingMarketStory] = useState<string | null>(null);
  const [postedMarketStories, setPostedMarketStories] = useState<Set<string>>(new Set());

  // Loading states
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);


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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    fetchNews(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        });
        toast.success('NEPSE data fetched! Review the preview below.');
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
    setImagePreview(null);
  };

  const handleFetchLatest = async () => {
    try {
      const res = await fetch('/api/market-data/fetch', { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        toast.success(json.message || 'Market data updated!');
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
    if (!previewData) return;
    setImagePreview(null);
    setIsGeneratingImages(true);
    try {
      // Generate images entirely in the browser — no server-side WASM/native deps
      const { gainers, losers } = parseStockDataFromRawData(previewData.marketData.rawData);
      if (gainers.length === 0 || losers.length === 0) {
        toast.error('No top gainers/losers data available from the data source. Cannot generate images.');
        setIsGeneratingImages(false);
        return;
      }
      const images = await generateImagesInBrowser(
        {
          tradingDate: previewData.marketData.tradingDate,
          nepseIndex: previewData.marketData.nepseIndex,
          change: previewData.marketData.change,
          changePercentage: previewData.marketData.changePercentage,
          turnover: previewData.marketData.turnover,
          volume: previewData.marketData.volume,
          trades: previewData.marketData.trades,
          gainers: previewData.marketData.gainers,
          losers: previewData.marketData.losers,
          unchanged: previewData.marketData.unchanged,
          rawData: previewData.marketData.rawData,
        },
        gainers,
        losers,
      );
      setImagePreview(images);
      setPostedCardIndices(new Set());
      setSummaryPosted(false);
      toast.success(`${3 + images.stockCards.length} images generated! Review them below.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate images');
    } finally {
      setIsGeneratingImages(false);
    }
  };

  const handleFetchIpo = async () => {
    setIsFetchingIpo(true);
    try {
      const res = await fetch('/api/news/ipo-status');
      const json = await res.json();
      if (json.success) {
        setIpoData(json.cdsc || []);
        setUpcomingIpoData(json.upcoming || []);
        setSebonPipelineData(json.sebonPipeline || []);
        const total = (json.cdscCount || 0) + (json.upcomingCount || 0);
        if (json.cached) {
          toast.info(`${total} IPO records — cached ${json.cacheAge}s ago`);
        } else {
          toast.success(`Fetched ${json.cdscCount || 0} active + ${json.upcomingCount || 0} upcoming IPOs`);
        }
      } else {
        toast.error(json.error || 'Failed to fetch IPO data');
      }
    } catch {
      toast.error('Network error fetching IPO data');
    } finally {
      setIsFetchingIpo(false);
    }
  };

  const isIpoOpenedToday = (openDate: string) => {
    if (!openDate) return false;
    try {
      const d = new Date(openDate + 'T00:00:00+05:45');
      const now = new Date();
      const nepalOffset = 5 * 60 + 45;
      const nowNepal = new Date(now.getTime() + (now.getTimezoneOffset() + nepalOffset) * 60000);
      return d.getUTCFullYear() === nowNepal.getUTCFullYear() &&
        d.getUTCMonth() === nowNepal.getUTCMonth() &&
        d.getUTCDate() === nowNepal.getUTCDate();
    } catch {
      return false;
    }
  };

  const isIpoCurrentlyOpen = (closeDate: string) => {
    if (!closeDate) return false;
    const close = new Date(closeDate + 'T23:59:59+05:45');
    return close > new Date();
  };

  const handleGenerateIpoImages = async () => {
    if (!ipoData || ipoData.length === 0) {
      toast.error('Fetch IPO data first');
      return;
    }
    setIsGeneratingIpoImages(true);
    setIpoCardImages([]);
    try {
      // Dynamically import satori's loadFonts is internal; use the generateIpoCardImage function
      // which accepts fonts — we need to load them first
      const weights = [400, 500, 600, 700, 800, 900];
      const fontPromises = weights.map(async (weight) => {
        const res = await fetch(`/fonts/Inter-${weight}.woff`);
        const buf = await res.arrayBuffer();
        return { name: 'Inter' as const, data: buf, weight, style: 'normal' as const };
      });
      const fonts = await Promise.all(fontPromises);

      const cards: Array<{ image: string; data: IpoCardData }> = [];
      for (const ipo of ipoData) {
        const isOpen = isIpoCurrentlyOpen(ipo.closeDate);
        const openedToday = isIpoOpenedToday(ipo.openDate);
        const cardData: IpoCardData = {
          ...ipo,
          isOpen,
          openedToday,
        };
        const image = await generateIpoCardImage(cardData, fonts);
        cards.push({ image, data: cardData });
      }
      setIpoCardImages(cards);
      toast.success(`${cards.length} IPO card image(s) generated!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate IPO images');
    } finally {
      setIsGeneratingIpoImages(false);
    }
  };

  const handlePostIpoCard = async (cardIndex: number) => {
    if (!ipoCardImages[cardIndex]) return;
    const { image, data } = ipoCardImages[cardIndex];
    setPostingIpoIndex(cardIndex);
    try {
      const res = await fetch('/api/posts/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'ipo_card',
          images: {
            ipoCardImage: image,
            ipoInfo: data,
          },
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`${data.companyName} IPO card posted to Facebook!`);
      } else {
        toast.error(`Failed: ${json.error || 'Unknown error'}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post');
    } finally {
      setPostingIpoIndex(null);
    }
  };

  const handleDownloadIpoCard = (cardIndex: number) => {
    const { image, data } = ipoCardImages[cardIndex];
    const a = document.createElement('a');
    a.href = image;
    a.download = `IPO_${data.companySymbol || data.companyName.replace(/\s+/g, '_')}.png`;
    a.click();
  };

  // ---- Story handler: generate portrait image + post ----
  const handlePostIpoStory = async (cardIndex: number) => {
    const card = ipoCardImages[cardIndex];
    if (!card) return;
    setPostingStoryIndex(cardIndex);
    try {
      // Load fonts and generate 1080x1920 story image
      const weights = [400, 500, 600, 700, 800, 900];
      const fonts = await Promise.all(weights.map(async (w) => {
        const res = await fetch(`/fonts/Inter-${w}.woff`);
        const buf = await res.arrayBuffer();
        return { name: 'Inter' as const, data: buf, weight: w, style: 'normal' as const };
      }));
      const storyImage = await generateIpoStoryImage(card.data, fonts);

      const res = await fetch('/api/posts/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: storyImage, ipoData: card.data }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`${card.data.companyName} Story posted!`);
        setPostedStoryIndices(prev => new Set(prev).add(cardIndex));
      } else {
        toast.error(`Failed: ${json.error || 'Unknown error'}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post Story');
    } finally {
      setPostingStoryIndex(null);
    }
  };

  // ---- IPO Result handlers ----
  const handleFetchIpoResultNews = async () => {
    setIsFetchingIpoResultNews(true);
    try {
      const res = await fetch('/api/news/ipo-result', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        toast.success(`Fetched ${json.totalScraped} result news, ${json.added} new`);
        loadIpoResultNews();
      } else {
        toast.error(json.error || 'Failed to fetch IPO result news');
      }
    } catch { toast.error('Network error'); } finally { setIsFetchingIpoResultNews(false); }
  };

  const loadIpoResultNews = async () => {
    setIsLoadingIpoResultNews(true);
    try {
      const res = await fetch('/api/news/latest?category=ipo&source=sharesansar&limit=30');
      if (res.ok) {
        const json = await res.json();
        const results = (json.items || []).filter((item: { headline: string }) =>
          /result|allotment|निष्कासन|आवंटन/i.test(item.headline)
        );
        setIpoResultNews(results);
      }
    } catch { /* ignore */ } finally { setIsLoadingIpoResultNews(false); }
  };

  const handlePostIpoResultNews = async (newsId: string) => {
    setPostingIpoResultNewsId(newsId);
    try {
      const res = await fetch('/api/news/post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newsId }) });
      const json = await res.json();
      if (json.success) {
        toast.success('IPO result news posted!');
        setIpoResultNews(prev => prev.map(n => n.id === newsId ? { ...n, isPosted: true, postedAt: new Date().toISOString() } : n));
      } else { toast.error(`Failed: ${json.error || 'Unknown'}`); }
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed'); } finally { setPostingIpoResultNewsId(null); }
  };

  const handleGenerateIpoResultImages = async () => {
    if (!ipoData || ipoData.length === 0) { toast.error('Fetch IPO data first'); return; }
    const closedWithResults = ipoData.filter(ipo => !isIpoCurrentlyOpen(ipo.closeDate) && ipo.numberOfApplications > 0 && ipo.appliedUnits > 0);
    if (closedWithResults.length === 0) { toast.error('No closed IPOs with result data'); return; }
    setIsGeneratingIpoResultImages(true);
    setIpoResultCardImages([]);
    try {
      const weights = [400, 500, 600, 700, 800, 900];
      const fonts = await Promise.all(weights.map(async (w) => {
        const r = await fetch(`/fonts/Inter-${w}.woff`);
        return { name: 'Inter' as const, data: await r.arrayBuffer(), weight: w, style: 'normal' as const };
      }));
      const cards: Array<{ image: string; data: IpoCardData }> = [];
      for (const ipo of closedWithResults) {
        const cardData: IpoCardData = { ...ipo, isOpen: false, openedToday: false };
        cards.push({ image: await generateIpoResultCardImage(cardData, fonts), data: cardData });
      }
      setIpoResultCardImages(cards);
      toast.success(`${cards.length} IPO result card(s) generated!`);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to generate'); } finally { setIsGeneratingIpoResultImages(false); }
  };

  const handlePostIpoResultCard = async (idx: number) => {
    const card = ipoResultCardImages[idx];
    if (!card) return;
    setPostingIpoResultCardIdx(idx);
    try {
      const res = await fetch('/api/posts/manual', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'ipo_result_card', images: { ipoResultCardImage: card.image, ipoInfo: card.data } }),
      });
      const json = await res.json();
      if (json.success) toast.success(`${card.data.companyName} result card posted!`);
      else toast.error(`Failed: ${json.error || 'Unknown'}`);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed'); } finally { setPostingIpoResultCardIdx(null); }
  };

  const handlePostIpoResultStory = async (idx: number) => {
    const card = ipoResultCardImages[idx];
    if (!card) return;
    setPostingIpoResultStoryIdx(idx);
    try {
      const weights = [400, 500, 600, 700, 800, 900];
      const fonts = await Promise.all(weights.map(async (w) => {
        const r = await fetch(`/fonts/Inter-${w}.woff`);
        return { name: 'Inter' as const, data: await r.arrayBuffer(), weight: w, style: 'normal' as const };
      }));
      const storyImage = await generateIpoResultStoryImage(card.data, fonts);
      const res = await fetch('/api/posts/story', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: storyImage, ipoData: card.data }) });
      const json = await res.json();
      if (json.success) { toast.success(`${card.data.companyName} result Story posted!`); setPostedIpoResultStoryIdxs(prev => new Set(prev).add(idx)); }
      else toast.error(`Failed: ${json.error || 'Unknown'}`);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed'); } finally { setPostingIpoResultStoryIdx(null); }
  };

  const handleDownloadIpoResultCard = (idx: number) => {
    const { image, data } = ipoResultCardImages[idx];
    const a = document.createElement('a');
    a.href = image;
    a.download = `IPO_Result_${data.companySymbol || data.companyName.replace(/\s+/g, '_')}.png`;
    a.click();
  };

  // ---- Reel handlers ----
  const handleReelFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate it's a video
    if (!file.type.startsWith('video/')) {
      toast.error('Please select a video file (MP4, MOV, etc.)');
      return;
    }

    // Vercel has a 4.5MB body limit — warn for large files
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Video must be under 50MB');
      return;
    }

    setReelFile(file);
    setReelPreviewUrl(URL.createObjectURL(file));
    if (!reelCaption) {
      setReelCaption(`${file.name.replace(/\.[^/.]+$/, '')}\n\n#NEPSE #ShareSathi #StockMarket #NepalStockExchange #NepalIPO`);
    }
  };

  const handlePostReel = async () => {
    if (!reelFile) { toast.error('Select a video first'); return; }
    setIsPostingReel(true);
    try {
      // Convert file to base64 and send as JSON
      const arrayBuffer = await reelFile.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const dataUri = `data:${reelFile.type};base64,${base64}`;

      const res = await fetch('/api/posts/reel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video: dataUri, caption: reelCaption }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Reel posted! FB ID: ${json.postId}`);
        setReelFile(null);
        setReelPreviewUrl(null);
        setReelCaption('');
      } else {
        toast.error(`Failed: ${json.error || 'Unknown error'}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post Reel');
    } finally {
      setIsPostingReel(false);
    }
  };

  // ---- Market Story handler: post 1080x1080 images as story ----
  const handlePostMarketStory = async (imageKey: string, label: string) => {
    if (!imagePreview) return;
    const imageData = imagePreview[imageKey as keyof typeof imagePreview];
    if (!imageData || typeof imageData !== 'string') return;

    setPostingMarketStory(imageKey);
    try {
      // Convert the 1080x1080 image to a 1080x1920 story by padding
      const weights = [400, 500, 600, 700, 800, 900];
      const fonts = await Promise.all(weights.map(async (w) => {
        const res = await fetch(`/fonts/Inter-${w}.woff`);
        const buf = await res.arrayBuffer();
        return { name: 'Inter' as const, data: buf, weight: w, style: 'normal' as const };
      }));

      // Build a story wrapper around the existing image
      const storyImage = await generateMarketStoryFromImage(
        imageData,
        previewData!.marketData,
        label,
        fonts,
      );

      const caption = label === 'Market Summary'
        ? `${previewData!.marketData.tradingDate} | NEPSE ${previewData!.marketData.nepseIndex.toFixed(2)} (${previewData!.marketData.change >= 0 ? '+' : ''}${previewData!.marketData.changePercentage.toFixed(2)}%)`
        : label === 'Top Gainers'
        ? `Top 10 Gainers | ${previewData!.marketData.tradingDate}`
        : `Top 10 Losers | ${previewData!.marketData.tradingDate}`;

      const res = await fetch('/api/posts/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: storyImage, message: caption }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`${label} Story posted!`);
        setPostedMarketStories(prev => new Set(prev).add(imageKey));
      } else {
        toast.error(`Failed: ${json.error || 'Unknown error'}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post Story');
    } finally {
      setPostingMarketStory(null);
    }
  };

  // ---- News handlers ----
  const fetchNews = async (loadPage = 1) => {
    setIsLoadingNews(true);
    try {
      const params = new URLSearchParams({
        page: String(loadPage),
        limit: '30',
        ...(newsFilter !== 'all' ? { source: newsFilter } : {}),
      });
      const res = await fetch(`/api/news/latest?${params}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setNewsItems(json.items || []);
        setNewsPage(json.pagination.page);
        setNewsTotalPages(json.pagination.totalPages);
      } else {
        console.error('Failed to load news:', json.error || res.status);
        toast.error(json.error || 'Failed to load news');
      }
    } catch (err) {
      toast.error('Failed to load news');
    } finally {
      setIsLoadingNews(false);
    }
  };

  const handleFetchNews = async () => {
    setIsFetchingNews(true);
    try {
      const res = await fetch('/api/news/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fetchSummaries: false }),
      });
      const json = await res.json();
      if (json.success) {
        if (json.added > 0) {
          const summaryInfo = ` (${json.summaryFetched || 0} summaries fetched, ${json.summarySkipped || 0} from RSS)`;
          const cleanupInfo = json.deletedOld > 0 ? ` | Cleaned ${json.deletedOld} old items` : '';
          toast.success(`${json.added} new news found & saved${summaryInfo}${cleanupInfo}`);
        } else {
          toast.info('No new news — all caught up!');
        }
        if (json.dbErrors?.length > 0) {
          console.error('News DB errors:', json.dbErrors);
          toast.error(`${json.dbErrors.length} items failed to save. Check console.`);
        }
        await fetchNews(1);
      } else {
        toast.error(`Failed: ${json.error || 'Unknown error'}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch news');
    } finally {
      setIsFetchingNews(false);
    }
  };

  const handlePostNews = async (newsId: string) => {
    setPostingNewsId(newsId);
    try {
      const res = await fetch('/api/news/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newsId }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('News posted to Facebook!');
        setPostedNewsIds(prev => new Set(prev).add(newsId));
        fetchNews(newsPage);
      } else {
        toast.error(`Failed: ${json.error || 'Unknown error'}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post news');
    } finally {
      setPostingNewsId(null);
    }
  };

  const handleDeleteNews = async (newsId: string) => {
    setDeletingNewsId(newsId);
    try {
      const res = await fetch(`/api/news/${newsId}/delete`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success('News deleted');
        fetchNews(newsPage);
      } else {
        toast.error(`Failed: ${json.error || 'Unknown error'}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete news');
    } finally {
      setDeletingNewsId(null);
    }
  };

  // News card image handlers
  const handleGenerateNewsCardImages = async () => {
    if (newsItems.length === 0) { toast.error('No news items to generate cards for'); return; }
    setIsGeneratingNewsImages(true);
    setNewsCardImages([]);
    try {
      const weights = [400, 500, 600, 700, 800, 900];
      const fonts = await Promise.all(weights.map(async (w) => {
        const r = await fetch(`/fonts/Inter-${w}.woff`);
        return { name: 'Inter' as const, data: await r.arrayBuffer(), weight: w, style: 'normal' as const };
      }));

      const cards: Array<{ image: string; data: { headline: string; summary: string; source: string; category: string; publishedAt: string; language: string; newsId: string } }> = [];
      for (const item of newsItems) {
        const image = await generateNewsCardImage({
          headline: item.headline,
          summary: item.summary,
          source: item.source,
          category: item.category,
          publishedAt: item.publishedAt,
          language: item.language,
        }, fonts);
        cards.push({
          image,
          data: {
            headline: item.headline,
            summary: item.summary,
            source: item.source,
            category: item.category,
            publishedAt: item.publishedAt,
            language: item.language,
            newsId: item.id,
          },
        });
      }
      setNewsCardImages(cards);
      toast.success(`Generated ${cards.length} news card images`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate news cards');
    } finally {
      setIsGeneratingNewsImages(false);
    }
  };

  const handlePostNewsCard = async (idx: number) => {
    const card = newsCardImages[idx];
    if (!card) return;
    setPostingNewsCardIdx(idx);
    try {
      const res = await fetch('/api/posts/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'news_card',
          images: { newsCardImage: card.image, newsInfo: { headline: card.data.headline, source: card.data.source, category: card.data.category, newsId: card.data.newsId } },
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`News card posted!`);
        setPostedNewsIds(prev => new Set(prev).add(card.data.newsId));
        fetchNews(newsPage);
      } else {
        toast.error(`Failed: ${json.error || 'Unknown'}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setPostingNewsCardIdx(null);
    }
  };

  const handleDownloadNewsCard = (idx: number) => {
    const { image, data } = newsCardImages[idx];
    const a = document.createElement('a');
    a.href = image;
    const safeName = data.headline.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 50);
    a.download = `News_${safeName}.png`;
    a.click();
  };

  // Auto-post trigger handler
  const handleAutoPost = async () => {
    setIsPosting(true);
    try {
      const res = await fetch('/api/auto-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manual: true }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message);
      } else {
        toast.error(json.message || json.error || 'Auto-post failed');
      }
      fetchSystemStatus();
      fetchRecentEvents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Auto-post failed');
    } finally {
      setIsPosting(false);
    }
  };

  const handlePostSingleCard = async (cardIndex: number) => {
    if (!imagePreview) return;
    const card = imagePreview.stockCards[cardIndex];
    if (!card) return;

    setPostingCardIndex(cardIndex);
    try {
      // Get stock data for caption
      const { gainers, losers } = parseStockDataFromRawData(previewData!.marketData.rawData);
      const allStocks = [...gainers, ...losers];
      const stockData = allStocks.find((s) => s.symbol === card.symbol);
      if (!stockData) {
        toast.error(`Stock data not found for ${card.symbol}`);
        return;
      }

      const res = await fetch('/api/posts/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'stock_card',
          date: previewData?.marketData?.tradingDate,
          images: {
            stockCardImage: card.image,
            cardInfo: {
              symbol: stockData.symbol,
              change: stockData.change,
              changePercent: stockData.changePercent,
              closePrice: stockData.closePrice,
              type: card.type,
            },
          },
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`${card.symbol} posted to Facebook!`);
        setPostedCardIndices((prev) => new Set(prev).add(cardIndex));
      } else {
        toast.error(`Failed: ${json.error || 'Unknown error'}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post');
    } finally {
      setPostingCardIndex(null);
    }
  };

  const handlePostImages = async () => {
    if (!imagePreview) return;
    setIsPosting(true);
    try {
      // Send ONLY the 3 summary images (stock cards have their own Post buttons)
      const dateToUse = previewData?.marketData?.tradingDate;
      const body: Record<string, unknown> = {
        mode: 'image',
        images: {
          marketSummary: imagePreview.marketSummary,
          topGainers: imagePreview.topGainers,
          topLosers: imagePreview.topLosers,
        },
      };
      if (dateToUse) body.date = dateToUse;

      const res = await fetch('/api/posts/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      let json: Record<string, unknown>;
      try {
        json = await res.json();
      } catch {
        toast.error('Received non-JSON response from server');
        return;
      }

      // If HTTP error or API returned success=false, show full error detail
      if (!res.ok || !json.success) {
        const failedPosts = (json.posts as Array<Record<string, unknown>>)?.filter((p) => !p.success) || [];
        if (failedPosts.length > 0) {
          // Build detailed error report
          const lines = failedPosts.map((p, i) => {
            const debug = p.debug as Record<string, unknown> | undefined;
            const lines = [
              `--- Post ${i + 1}: ${p.label || 'Unknown'} ---`,
              `Status: FAILED`,
              `Error: ${p.error || 'No error message'}`,
              debug ? `Image Size: ${((debug.imageBufferSize as number) || 0)} bytes` : '',
              debug ? `Caption Length: ${debug.captionLength || 0} chars` : '',
              debug ? `Caption Preview: ${debug.captionPreview || 'N/A'}` : '',
            ].filter(Boolean).join('\n');
            return lines;
          });
          setErrorDialogTitle(`Facebook Posting Failed (${failedPosts.length} post${failedPosts.length > 1 ? 's' : ''})`);
          setErrorDetailText(lines.join('\n\n'));
          setShowErrorDialog(true);
        } else {
          // No per-post errors — show the top-level error
          setErrorDialogTitle('Posting Failed');
          setErrorDetailText(`HTTP Status: ${res.status}\n\nFull Response:\n${JSON.stringify(json, null, 2)}`);
          setShowErrorDialog(true);
        }
        return;
      }

      // Success path
      const posts = json.posts as Array<{ success: boolean; label: string; postId?: string; error?: string; debug?: Record<string, unknown> }>;
      const postCount = posts?.length || 3;
      const successCount = posts?.filter((p) => p.success).length || 0;
      const failedPosts = posts?.filter((p) => !p.success) || [];

      if (successCount === postCount) {
        toast.success(`All ${postCount} images posted to Facebook!`);
        setSummaryPosted(true);
      } else {
        // Show error dialog with full details for each failed post
        const lines = failedPosts.map((p, i) => {
          const debug = p.debug;
          return [
            `--- Post ${i + 1}: ${p.label || 'Unknown'} ---`,
            `Status: FAILED`,
            `Error: ${p.error || 'No error message'}`,
            debug ? `Image Size: ${debug.imageBufferSize || 0} bytes` : '',
            debug ? `Caption Length: ${debug.captionLength || 0} chars` : '',
            debug ? `Caption Preview: ${debug.captionPreview || 'N/A'}` : '',
          ].filter(Boolean).join('\n');
        });
        setErrorDialogTitle(`Partial Failure (${successCount}/${postCount} posted)`);
        setErrorDetailText(lines.join('\n\n'));
        setShowErrorDialog(true);

        if (successCount > 0) {
          toast.success(`${successCount}/${postCount} posted successfully`);
        }
      }
        // Refresh data on any response (success or partial)
      fetchSystemStatus();
      fetchLatestData();
      fetchRecentEvents();
      fetchPosts(1, 'all');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setErrorDialogTitle('Network Error');
      setErrorDetailText(msg);
      setShowErrorDialog(true);
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

          {/* Fetch & Preview - always visible when no data yet */}
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
              {postMode === 'image' && !imagePreview && (
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
              )}
              {postMode === 'image' && imagePreview && (
                <Button
                  onClick={handlePostImages}
                  disabled={isPosting || summaryPosted}
                  size="lg"
                  className="gap-2"
                >
                  {summaryPosted ? (
                    <><CheckCircle2 className="h-4 w-4" /> Posted</>
                  ) : isPosting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Posting 3 Images...</>
                  ) : (
                    <><Send className="h-4 w-4" /> Post 3 Images</>
                  )}
                </Button>
              )}
              {postMode === 'text' && (
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
              )}
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
              <CardDescription>3 summary images + {imagePreview.stockCards.length} individual stock cards</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { src: imagePreview.marketSummary, label: '1. Market Summary', key: 'marketSummary' },
                  { src: imagePreview.topGainers, label: '2. Top 10 Gainers', key: 'topGainers' },
                  { src: imagePreview.topLosers, label: '3. Top 10 Losers', key: 'topLosers' },
                ].map((item) => (
                  <div key={item.label} className="space-y-2 relative">
                    <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
                    <div className="rounded-lg overflow-hidden border border-border bg-muted">
                      <img src={item.src} alt={item.label} className="w-full h-auto" />
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={postingMarketStory === item.key || postedMarketStories.has(item.key)}
                        onClick={() => handlePostMarketStory(item.key, item.label.replace(/^\d+\.\s/, ''))}
                        className="flex-1 gap-1 text-purple-600 border-purple-300 hover:bg-purple-50"
                      >
                        {postedMarketStories.has(item.key) ? (
                          <><CheckCircle2 className="h-3 w-3" /> Story Posted</>
                        ) : postingMarketStory === item.key ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Posting...</>
                        ) : (
                          <><Film className="h-3 w-3" /> Story</>
                        )}
                      </Button>
                    </div>
                    {summaryPosted && (
                      <div className="absolute top-6 right-2">
                        <span className="inline-flex items-center gap-1 bg-emerald-500 text-white text-xs font-semibold px-2 py-1 rounded-md">
                          <CheckCircle2 className="h-3 w-3" /> Posted
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Individual Stock Cards */}
          {imagePreview.stockCards.length > 0 && (
            <Card className="border-blue-500/50 bg-blue-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-blue-500" />
                  Individual Stock Cards
                </CardTitle>
                <CardDescription>Click "Post" below any card to post it individually to Facebook</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {imagePreview.stockCards.map((card, idx) => (
                    <div key={`${card.type}-${card.rank}`} className="space-y-2">
                      <div className="rounded-lg overflow-hidden border border-border bg-muted">
                        <img src={card.image} alt={card.symbol} className="w-full h-auto" />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{card.symbol}</p>
                          <p className={`text-xs ${card.type === 'gainer' ? 'text-emerald-500' : 'text-red-500'}`}>
                            {card.type === 'gainer' ? 'Gainer' : 'Loser'} #{card.rank}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant={postedCardIndices.has(idx) ? 'secondary' : 'outline'}
                          disabled={postingCardIndex === idx || postedCardIndices.has(idx)}
                          onClick={() => handlePostSingleCard(idx)}
                          className="shrink-0"
                        >
                          {postedCardIndices.has(idx) ? (
                            <><CheckCircle2 className="h-3 w-3 mr-1" /> Posted</>
                          ) : postingCardIndex === idx ? (
                            <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Posting</>
                          ) : (
                            'Post'
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Preview Card - shown for both modes after fetch */}
      {previewData && (
        <Card className="border-blue-500/50 bg-blue-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Eye className="h-4 w-4 text-blue-500" />
                  Post Preview
                </CardTitle>
                <CardDescription className="mt-1">
                  Data source: <span className="text-emerald-500 font-medium">{previewData.source}</span> | Date: {previewData.marketData.tradingDate}
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
                <p className="text-xs mt-1">Click &quot;Fetch &amp; Preview&quot; to get the latest NEPSE data</p>
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
              <p className="text-xs mt-1">Click &quot;Fetch Latest&quot; to get NEPSE data</p>
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

  // ---- News Tab ----
  const renderNewsTab = () => {
    const sourceColors: Record<string, string> = {
      merolagani: 'bg-orange-500/15 text-orange-500 border-orange-500/20',
      sharesansar: 'bg-blue-500/15 text-blue-500 border-blue-500/20',
      sebon: 'bg-purple-500/15 text-purple-500 border-purple-500/20',
      google_news: 'bg-red-500/15 text-red-500 border-red-500/20',
      myrepublica: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20',
    };

    const categoryColors: Record<string, string> = {
      market: 'bg-sky-500/15 text-sky-500',
      ipo: 'bg-amber-500/15 text-amber-500',
      company: 'bg-violet-500/15 text-violet-500',
      regulatory: 'bg-rose-500/15 text-rose-500',
      general: 'bg-gray-500/15 text-gray-500',
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Share Market News</h2>
            <p className="text-muted-foreground text-sm">Headlines from Mero Lagani, Share Sansar, SEBON & more</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleFetchNews} disabled={isFetchingNews} size="lg" className="gap-2">
              {isFetchingNews ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rss className="h-4 w-4" />}
              {isFetchingNews ? 'Fetching...' : 'Fetch News'}
            </Button>
            <Button
              variant="outline"
              onClick={handleGenerateNewsCardImages}
              disabled={isGeneratingNewsImages || newsItems.length === 0}
              size="lg"
              className="gap-2"
            >
              {isGeneratingNewsImages ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
              {isGeneratingNewsImages ? 'Generating...' : 'Generate News Cards'}
            </Button>
          </div>
        </div>

        {/* Source filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Filter:</span>
          {['all', 'merolagani', 'sharesansar', 'sebon', 'google_news', 'myrepublica'].map((s) => (
            <Button
              key={s}
              size="sm"
              variant={newsFilter === s ? 'default' : 'outline'}
              onClick={() => { setNewsFilter(s); fetchNews(1); }}
              className="text-xs h-7"
            >
              {s === 'all' ? 'All Sources' : s === 'google_news' ? 'Google News' : s === 'myrepublica' ? 'My Republica' : s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>

        {isLoadingNews ? (
          <Card>
            <CardContent className="pt-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2 p-4 rounded-lg border">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : newsItems.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Rss className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-1">No News Yet</h3>
              <p className="text-sm text-muted-foreground">Click &quot;Fetch News&quot; to scrape headlines from multiple sources</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {newsItems.map((item) => (
                    <div
                      key={item.id}
                      className={`flex flex-col sm:flex-row sm:items-start gap-3 p-4 rounded-lg border ${
                        item.isPosted ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-card border-border'
                      } transition-colors`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 flex-wrap">
                          <h4 className={`font-semibold text-sm leading-tight ${item.language === 'ne' ? 'font-bold' : ''}`}>
                            {item.headline}
                          </h4>
                          {item.isPosted && (
                            <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/20 shrink-0">Posted</Badge>
                          )}
                        </div>
                        {item.summary && !/^(merolagani|sharesansar|google_news|myrepublica)\s*[-–—]/i.test(item.summary) && !item.summary.includes("for the latest") && (
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{item.summary}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] h-5 ${sourceColors[item.source] || ''}`}>
                            {item.source === 'merolagani' ? 'Mero Lagani' : item.source === 'google_news' ? 'Google News' : item.source === 'myrepublica' ? 'My Republica' : item.source}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] h-5 ${categoryColors[item.category] || ''}`}>
                            {item.category}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {item.language === 'ne' ? '🇳🇵 ' : '🇬🇧 '}{timeAgo(item.publishedAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant={item.isPosted ? 'secondary' : 'outline'}
                          disabled={postingNewsId === item.id || item.isPosted}
                          onClick={() => handlePostNews(item.id)}
                          className="gap-1"
                        >
                          {postingNewsId === item.id ? (
                            <><Loader2 className="h-3 w-3 animate-spin" /> Posting</>
                          ) : item.isPosted ? (
                            <><CheckCircle2 className="h-3 w-3" /> Posted</>
                          ) : (
                            <><Send className="h-3 w-3" /> Post</>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={deletingNewsId === item.id}
                          onClick={() => handleDeleteNews(item.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Delete news"
                        >
                          {deletingNewsId === item.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Pagination */}
            {newsTotalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  size="sm" variant="outline"
                  disabled={newsPage <= 1}
                  onClick={() => fetchNews(newsPage - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {newsPage} of {newsTotalPages}
                </span>
                <Button
                  size="sm" variant="outline"
                  disabled={newsPage >= newsTotalPages}
                  onClick={() => fetchNews(newsPage + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}

        {/* Generating news cards indicator */}
        {isGeneratingNewsImages && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Generating news card images...</span>
          </div>
        )}

        {/* Generated News Card Images */}
        {newsCardImages.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Generated News Cards ({newsCardImages.length})</CardTitle>
              <CardDescription>Image cards for news — post to Facebook feed. Headline is used as caption, summary is in the image.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {newsCardImages.map((card, idx) => (
                  <Card key={idx} className="overflow-hidden">
                    <div className="aspect-square relative">
                      <img src={card.image} alt={card.data.headline} className="w-full h-full object-contain bg-white" />
                      {postedNewsIds.has(card.data.newsId) && (
                        <div className="absolute top-1 right-1 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">Posted</div>
                      )}
                    </div>
                    <CardContent className="p-2 flex gap-1">
                      <Button
                        size="sm"
                        className="flex-1 gap-1 text-xs"
                        disabled={postingNewsCardIdx === idx || postedNewsIds.has(card.data.newsId)}
                        onClick={() => handlePostNewsCard(idx)}
                      >
                        {postingNewsCardIdx === idx ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        Post
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => handleDownloadNewsCard(idx)}>
                        <Download className="h-3 w-3" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

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
            <CardDescription>Configure auto-posting schedule and data verification</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-Post Enabled</Label>
                <p className="text-xs text-muted-foreground">Fetch NEPSE data daily, verify against real-time sources, and post to Facebook.</p>
              </div>
              <Switch
                checked={settings.auto_post_enabled === 'true'}
                onCheckedChange={(checked) =>
                  setSettings((s) => ({ ...s, auto_post_enabled: String(checked) }))
                }
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Off Days</Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">Market closed days. No fetching or posting on these days.</p>
              <div className="grid grid-cols-7 gap-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => {
                  const offDaysArr = (settings.off_days || '0,6').split(',').map(d => parseInt(d.trim(), 10));
                  const isOff = offDaysArr.includes(i);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        const arr = (settings.off_days || '0,6').split(',').map(d => parseInt(d.trim(), 10));
                        const next = isOff ? arr.filter(d => d !== i) : [...arr, i];
                        setSettings((s) => ({ ...s, off_days: next.sort((a, b) => a - b).join(',') }));
                      }}
                      className={`text-xs py-1.5 rounded-md font-medium transition-colors ${
                        isOff
                          ? 'bg-destructive text-destructive-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground">Red = off day (no auto-post). Default: Sunday &amp; Saturday.</p>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="refetchInterval">Re-fetch Interval (minutes)</Label>
              <Input
                id="refetchInterval"
                type="number"
                min="1"
                max="30"
                value={settings.refetch_interval_minutes || '5'}
                onChange={(e) => setSettings((s) => ({ ...s, refetch_interval_minutes: e.target.value }))}
              />
              <p className="text-[10px] text-muted-foreground">If YONEPSE data doesn&apos;t match live NEPSE/MeroLagani, waits this long before re-fetching. Max 6 cycles.</p>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="postTime">Caption Time (NPT)</Label>
              <Input
                id="postTime"
                type="time"
                value={settings.post_time}
                onChange={(e) => setSettings((s) => ({ ...s, post_time: e.target.value }))}
              />
              <p className="text-[10px] text-muted-foreground">Time shown in Facebook post captions.</p>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="hashtags">Hashtags</Label>
              <Textarea
                id="hashtags"
                placeholder="#NEPSE #ShareSathi #NepalStockExchange #ShareMarket #StockMarketNepal #StockMarket"
                value={settings.hashtags || ''}
                onChange={(e) => setSettings((s) => ({ ...s, hashtags: e.target.value }))}
                rows={2}
                className="text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Custom hashtags for all auto-posts. Leave empty to use defaults.</p>
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
              onClick={handleAutoPost}
              disabled={isPosting}
              size="sm"
              variant="outline"
              className="w-full gap-1"
            >
              {isPosting ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Running Auto-Post...</>
              ) : (
                <><Send className="h-3.5 w-3.5" /> Trigger Auto-Post Now</>
              )}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">Manually trigger. Bypasses off-day check.</p>
            <Separator />
            <Button
              onClick={() => handleSaveSection(
                ['auto_post_enabled', 'post_time', 'refetch_interval_minutes', 'off_days', 'hashtags', 'notification_email'],
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
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // ---- IPO & News Tab ----
  const renderIpoTab = () => {
    const formatNepaliAmount = (n: number) => {
      if (n >= 10000000) return `${(n / 10000000).toFixed(2)} Cr`;
      if (n >= 100000) return `${(n / 100000).toFixed(2)} L`;
      return n.toLocaleString('en-US');
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">IPO & News</h2>
            <p className="text-muted-foreground text-sm">Live IPO data from CDSC Nepal</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleFetchIpo} disabled={isFetchingIpo} size="lg" className="gap-2">
              {isFetchingIpo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isFetchingIpo ? 'Fetching...' : 'Fetch IPO Data'}
            </Button>
            {ipoData && ipoData.length > 0 && (
              <Button onClick={handleGenerateIpoImages} disabled={isGeneratingIpoImages} variant="outline" size="lg" className="gap-2">
                {isGeneratingIpoImages ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                {isGeneratingIpoImages ? 'Generating...' : 'Generate Images'}
              </Button>
            )}
          </div>
        </div>

        {/* IPO Tab Navigation */}
        {(ipoData !== null || upcomingIpoData !== null || sebonPipelineData !== null) && (
          <div className="flex gap-1 border-b">
            <button
              onClick={() => setIpoActiveTab('cdsc')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                ipoActiveTab === 'cdsc' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Active IPOs{ipoData !== null ? ` (${ipoData.length})` : ''}
            </button>
            <button
              onClick={() => setIpoActiveTab('upcoming')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                ipoActiveTab === 'upcoming' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Upcoming IPOs{upcomingIpoData !== null ? ` (${upcomingIpoData.length})` : ''}
            </button>
            <button
              onClick={() => setIpoActiveTab('sebon')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                ipoActiveTab === 'sebon' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              SEBON Pipeline{sebonPipelineData !== null ? ` (${sebonPipelineData.length})` : ''}
            </button>
            <button
              onClick={() => setIpoActiveTab('results')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                ipoActiveTab === 'results' ? 'border-amber-500 text-amber-500' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Trophy className="h-3.5 w-3.5" /> Results
            </button>
          </div>
        )}

        {ipoActiveTab === 'cdsc' && (
          ipoData === null ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Newspaper className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-1">No IPO Data Loaded</h3>
              <p className="text-sm text-muted-foreground">Click &quot;Fetch IPO Data&quot; to get live IPO status from CDSC</p>
            </CardContent>
          </Card>
        ) : ipoData.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Newspaper className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-1">No Active IPOs</h3>
              <p className="text-sm text-muted-foreground">There are currently no open or recent IPOs listed on CDSC</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Data table — full raw data */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">IPO Listing ({ipoData.length})</CardTitle>
                <CardDescription className="text-xs">Raw data from CDSC Nepal — verify before generating images</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Company</TableHead>
                        <TableHead className="text-right">Issued Units</TableHead>
                        <TableHead className="text-right">Applications</TableHead>
                        <TableHead className="text-right">Applied Units</TableHead>
                        <TableHead className="text-right">Total Amount</TableHead>
                        <TableHead className="text-right">Oversub.</TableHead>
                        <TableHead>Open Date</TableHead>
                        <TableHead>Close Date</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ipoData.map((ipo, idx) => {
                        const open = isIpoCurrentlyOpen(ipo.closeDate);
                        const openedToday = isIpoOpenedToday(ipo.openDate);
                        const sub = ipo.oversubscription;
                        const hasData = ipo.numberOfApplications > 0 || ipo.appliedUnits > 0 || ipo.totalAmount > 0;
                        return (
                          <TableRow key={idx}>
                            <TableCell>
                              <div className="font-semibold text-sm">{ipo.companyName}</div>
                              <div className="text-xs text-muted-foreground">
                                {ipo.companySymbol && <span>{ipo.companySymbol} · </span>}
                                {ipo.ipoType}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">Manager: {ipo.issueManager}</div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">{ipo.issuedUnits.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{hasData ? ipo.numberOfApplications.toLocaleString() : '—'}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{hasData ? ipo.appliedUnits.toLocaleString() : '—'}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{hasData ? `Rs. ${formatNepaliAmount(ipo.totalAmount)}` : '—'}</TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {sub !== null && sub > 0 ? `${sub.toFixed(2)}x` : '—'}
                            </TableCell>
                            <TableCell className="text-xs font-mono">{ipo.openDate}</TableCell>
                            <TableCell className="text-xs font-mono">{ipo.closeDate}</TableCell>
                            <TableCell className="text-center">
                              {open ? (
                                <Badge className="bg-emerald-500 text-white text-xs">
                                  {openedToday ? 'Opened Today' : 'Open'}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Closed</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Generated IPO Card Images */}
            {isGeneratingIpoImages && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Generating IPO card images...</span>
              </div>
            )}

            {ipoCardImages.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">IPO Card Images</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {ipoCardImages.map((card, idx) => (
                    <Card key={idx} className="overflow-hidden">
                      <div className="aspect-square relative">
                        <img src={card.image} alt={card.data.companyName} className="w-full h-full object-contain bg-white" />
                        {postedStoryIndices.has(idx) && (
                          <div className="absolute top-1 right-1 bg-purple-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">Story</div>
                        )}
                      </div>
                      <CardContent className="p-2 flex gap-1">
                        <Button
                          size="sm"
                          className="flex-1 gap-1 text-xs"
                          disabled={postingIpoIndex === idx}
                          onClick={() => handlePostIpoCard(idx)}
                        >
                          {postingIpoIndex === idx ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                          Post
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs text-purple-600 border-purple-300 hover:bg-purple-50"
                          disabled={postingStoryIndex === idx}
                          onClick={() => handlePostIpoStory(idx)}
                          title="Post as Facebook Story"
                        >
                          {postingStoryIndex === idx ? <Loader2 className="h-3 w-3 animate-spin" /> : <Newspaper className="h-3 w-3" />}
                          Story
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => handleDownloadIpoCard(idx)}>
                          <Download className="h-3 w-3" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground text-center">
              Data source: CDSC Nepal (cdsc.com.np) · Last fetched: {new Date().toLocaleString()}
            </p>
          </div>
        ))}

        {ipoActiveTab === 'upcoming' && (
          upcomingIpoData === null ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-1">No Data Loaded</h3>
                <p className="text-sm text-muted-foreground">Click &quot;Fetch IPO Data&quot; to load upcoming IPOs</p>
              </CardContent>
            </Card>
          ) : upcomingIpoData.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-1">No Upcoming IPOs</h3>
                <p className="text-sm text-muted-foreground">There are no upcoming IPOs in the pipeline</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Upcoming IPOs ({upcomingIpoData.length})</CardTitle>
                <CardDescription>Companies applied for IPO — waiting for SEBON approval &amp; opening date</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead className="min-w-[200px]">Company</TableHead>
                        <TableHead>Sector</TableHead>
                        <TableHead className="text-right">Units</TableHead>
                        <TableHead className="text-right">Total Amount</TableHead>
                        <TableHead>Applied On</TableHead>
                        <TableHead>SEBON Date</TableHead>
                        <TableHead>Issue Manager</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {upcomingIpoData.map((ipo, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono font-semibold text-sm">{ipo.symbol || '—'}</TableCell>
                          <TableCell className="text-sm">{ipo.companyName}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{ipo.sector || '—'}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{ipo.units > 0 ? ipo.units.toLocaleString() : '—'}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{ipo.totalAmount > 0 ? `Rs. ${formatNepaliAmount(ipo.totalAmount)}` : '—'}</TableCell>
                          <TableCell className="text-xs font-mono">{ipo.applicationDate || '—'}</TableCell>
                          <TableCell className="text-xs font-mono">{ipo.sebonDate || '—'}</TableCell>
                          <TableCell className="text-xs">{ipo.issueManager || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )
        )}

        {ipoActiveTab === 'sebon' && (
          sebonPipelineData === null ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-1">No Data Loaded</h3>
                <p className="text-sm text-muted-foreground">Click &quot;Fetch IPO Data&quot; to load SEBON pipeline</p>
              </CardContent>
            </Card>
          ) : sebonPipelineData.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-1">No SEBON Entries</h3>
                <p className="text-sm text-muted-foreground">There are no entries in the SEBON pipeline</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>SEBON IPO Pipeline ({sebonPipelineData.length})</CardTitle>
                <CardDescription>Official IPO application lists published by SEBON (sebon.gov.np)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sebonPipelineData.map((entry, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div>
                        <div className="font-medium text-sm">{entry.title}</div>
                        <div className="text-xs text-muted-foreground">Published: {entry.date}</div>
                      </div>
                      <div className="flex gap-2">
                        {entry.englishUrl && (
                          <a href={entry.englishUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 border border-blue-200">
                            <ExternalLink className="h-3 w-3" /> English
                          </a>
                        )}
                        {entry.nepaliUrl && (
                          <a href={entry.nepaliUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-orange-50 text-orange-700 rounded-md hover:bg-orange-100 border border-orange-200">
                            <ExternalLink className="h-3 w-3" /> Nepali
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        )}

        {ipoActiveTab === 'results' && (
          <div className="space-y-4">
            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                className="gap-2"
                disabled={isFetchingIpoResultNews}
                onClick={handleFetchIpoResultNews}
              >
                {isFetchingIpoResultNews ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rss className="h-4 w-4" />}
                Fetch IPO Result News
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                disabled={isGeneratingIpoResultImages || ipoData === null || ipoData.length === 0}
                onClick={handleGenerateIpoResultImages}
              >
                {isGeneratingIpoResultImages ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                Generate Result Cards
              </Button>
            </div>

            {/* Loading state */}
            {isLoadingIpoResultNews && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">Loading IPO result news...</span>
              </div>
            )}

            {/* News articles list */}
            {!isLoadingIpoResultNews && ipoResultNews.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    IPO Result News ({ipoResultNews.length})
                  </CardTitle>
                  <CardDescription>Latest IPO allotment &amp; result news from ShareSansar</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {ipoResultNews.map((news) => (
                      <div key={news.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-card">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{news.headline}</div>
                          {news.summary && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{news.summary}</p>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            {new Date(news.publishedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {news.isPosted && (
                              <Badge variant="secondary" className="ml-2 text-[10px]">Posted</Badge>
                            )}
                          </div>
                        </div>
                        {!news.isPosted && (
                          <Button
                            size="sm"
                            className="shrink-0 gap-1 text-xs"
                            disabled={postingIpoResultNewsId === news.id}
                            onClick={() => handlePostIpoResultNews(news.id)}
                          >
                            {postingIpoResultNewsId === news.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                            Post
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {!isLoadingIpoResultNews && ipoResultNews.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Trophy className="h-10 w-10 text-muted-foreground mb-3" />
                  <h3 className="text-base font-semibold mb-1">No IPO Result News</h3>
                  <p className="text-sm text-muted-foreground">Click &quot;Fetch IPO Result News&quot; to scrape latest allotment news from ShareSansar</p>
                </CardContent>
              </Card>
            )}

            {/* Generated Result Card Images */}
            {isGeneratingIpoResultImages && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">Generating IPO result card images...</span>
              </div>
            )}

            {ipoResultCardImages.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Generated Result Cards ({ipoResultCardImages.length})</CardTitle>
                  <CardDescription>Image cards for closed IPOs — post to Facebook feed or as Story</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {ipoResultCardImages.map((card, idx) => (
                      <Card key={idx} className="overflow-hidden">
                        <div className="aspect-square relative">
                          <img src={card.image} alt={card.data.companyName} className="w-full h-full object-contain bg-white" />
                          {postedIpoResultStoryIdxs.has(idx) && (
                            <div className="absolute top-1 right-1 bg-purple-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">Story</div>
                          )}
                        </div>
                        <CardContent className="p-2 flex gap-1">
                          <Button
                            size="sm"
                            className="flex-1 gap-1 text-xs"
                            disabled={postingIpoResultCardIdx === idx}
                            onClick={() => handlePostIpoResultCard(idx)}
                          >
                            {postingIpoResultCardIdx === idx ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                            Post
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs text-purple-600 border-purple-300 hover:bg-purple-50"
                            disabled={postingIpoResultStoryIdx === idx}
                            onClick={() => handlePostIpoResultStory(idx)}
                            title="Post as Facebook Story"
                          >
                            {postingIpoResultStoryIdx === idx ? <Loader2 className="h-3 w-3 animate-spin" /> : <Newspaper className="h-3 w-3" />}
                            Story
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => handleDownloadIpoResultCard(idx)}>
                            <Download className="h-3 w-3" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ---- Reels Upload Section ---- */}
            <Card className="mt-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Film className="h-5 w-5" />
                  Upload Facebook Reel
                </CardTitle>
                <CardDescription>
                  Upload a short video (up to 90s, max 50MB) to post as a Facebook Reel. Recommended: 1080x1920 portrait, MP4 format.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Drop zone / file selector */}
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  onClick={() => document.getElementById('reel-file-input')?.click()}
                >
                  {reelPreviewUrl ? (
                    <div className="space-y-3">
                      <video
                        src={reelPreviewUrl}
                        className="max-h-64 mx-auto rounded-lg"
                        controls
                        playsInline
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (reelPreviewUrl) URL.revokeObjectURL(reelPreviewUrl);
                          setReelFile(null);
                          setReelPreviewUrl(null);
                        }}
                      >
                        <X className="h-4 w-4 mr-1" /> Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="text-sm font-medium">Click to select a video</p>
                      <p className="text-xs text-muted-foreground">MP4, MOV, WebM — max 50MB</p>
                    </div>
                  )}
                  <input
                    id="reel-file-input"
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={handleReelFileSelect}
                  />
                </div>

                {/* Caption */}
                <div className="space-y-2">
                  <Label htmlFor="reel-caption" className="text-sm font-medium">Caption</Label>
                  <Textarea
                    id="reel-caption"
                    placeholder="Write a caption for your Reel..."
                    value={reelCaption}
                    onChange={(e) => setReelCaption(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Post button */}
                <Button
                  className="w-full gap-2"
                  disabled={!reelFile || isPostingReel}
                  onClick={handlePostReel}
                >
                  {isPostingReel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
                  {isPostingReel ? 'Uploading Reel...' : 'Post as Reel'}
                  {reelFile && (
                    <span className="text-xs opacity-70">
                      ({(reelFile.size / 1024 / 1024).toFixed(1)}MB)
                    </span>
                  )}
                </Button>
              </CardContent>
            </Card>
      </div>
    );
  };

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
      {/* Error Detail Dialog */}
      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-red-500">{errorDialogTitle}</DialogTitle>
            <DialogDescription>Full error details below. You can copy this to share for debugging.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <pre className="bg-muted p-4 rounded-md text-xs font-mono whitespace-pre-wrap break-all text-foreground">{errorDetailText}</pre>
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(errorDetailText);
                toast.success('Error details copied to clipboard');
              }}
            >
              Copy to Clipboard
            </Button>
            <Button size="sm" onClick={() => setShowErrorDialog(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                window.location.href = '/auth/login';
              }}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
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
            <TabsTrigger value="ipo" className="gap-1.5">
              <Newspaper className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">IPO & News</span>
            </TabsTrigger>
            <TabsTrigger value="news" className="gap-1.5">
              <Rss className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">News</span>
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
          <TabsContent value="ipo">{renderIpoTab()}</TabsContent>
          <TabsContent value="news">{renderNewsTab()}</TabsContent>
          <TabsContent value="settings">{renderSettings()}</TabsContent>
          <TabsContent value="logs">{renderLogs()}</TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-1">
          <p className="text-[11px] text-muted-foreground">© 2026 Share Sathi — Built for Kiran Pradhan</p>
          <p className="text-xs text-muted-foreground">NEPSE Market Automation • 100% Free • Nepal</p>
        </div>
      </footer>
    </div>
  );
}