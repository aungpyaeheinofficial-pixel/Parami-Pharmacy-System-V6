
import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { TrendingUp, Users, AlertTriangle, ArrowUpRight, ArrowDownRight, RefreshCw, ShoppingCart, Activity, Sparkles, BrainCircuit, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../components/UI';
import { useProductStore, useTransactionStore, useCustomerStore, useDistributionStore } from '../store';
import { Transaction } from '../types';
import { GoogleGenAI } from "@google/genai";

interface DashboardMetrics {
  totalRevenue: number;
  revenueGrowth: number;
  lowStockCount: number;
  totalCustomers: number;
  recentTransactions: Transaction[];
  chartData: any[];
  categoryData: any[];
}

const getDateRange = (filter: 'Today' | 'Week' | 'Month' | 'Year') => {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  const prevStart = new Date(now);
  const prevEnd = new Date(now);
  end.setHours(23, 59, 59, 999);
  if (filter === 'Today') {
    start.setHours(0, 0, 0, 0);
    prevStart.setDate(now.getDate() - 1);
    prevStart.setHours(0, 0, 0, 0);
    prevEnd.setDate(now.getDate() - 1);
    prevEnd.setHours(23, 59, 59, 999);
  } else if (filter === 'Week') {
    const day = now.getDay();
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);
    prevStart.setDate(start.getDate() - 7);
    prevEnd.setDate(start.getDate() - 1);
    prevEnd.setHours(23, 59, 59, 999);
  } else if (filter === 'Month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    prevStart.setMonth(now.getMonth() - 1);
    prevStart.setDate(1);
    prevEnd.setDate(0);
    prevEnd.setHours(23, 59, 59, 999);
  } else if (filter === 'Year') {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    prevStart.setFullYear(now.getFullYear() - 1);
    prevStart.setMonth(0, 1);
    prevEnd.setFullYear(now.getFullYear() - 1);
    prevEnd.setMonth(11, 31);
    prevEnd.setHours(23, 59, 59, 999);
  }
  return { start, end, prevStart, prevEnd };
};

const COLORS = ['#3B82F6', '#D7000F', '#10B981', '#F59E0B', '#8B5CF6'];

const StatCard = ({ title, value, subValue, trend, trendValue, icon: Icon, colorClass, onClick }: any) => (
  <div 
    onClick={onClick}
    className={`bg-white p-6 rounded-2xl shadow-card hover:shadow-card-hover border border-slate-200/60 group transition-all duration-300 ${onClick ? 'cursor-pointer hover:-translate-y-1' : ''}`}
  >
    <div className="flex justify-between items-start mb-4">
      <div className={`w-12 h-12 rounded-2xl ${colorClass} bg-opacity-10 flex items-center justify-center`}>
          <Icon size={24} className={colorClass.replace('bg-', 'text-').replace('100', '600')} />
      </div>
      {trendValue && (
          <span className={`flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${trend === 'up' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
              {trend === 'up' ? <ArrowUpRight size={10} className="mr-0.5"/> : <ArrowDownRight size={10} className="mr-0.5"/>}
              {trendValue}
          </span>
      )}
    </div>
    <div>
      <p className="text-slate-500 text-sm font-semibold tracking-wide uppercase text-[10px]">{title}</p>
      <h3 className="text-3xl font-bold text-slate-800 mt-1 tracking-tight">{value}</h3>
      {subValue && <p className="text-xs text-slate-400 mt-1.5 font-medium">{subValue}</p>}
    </div>
  </div>
);

const AIInsights = () => {
    const { products } = useProductStore();
    const [insight, setInsight] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const generateInsight = async () => {
        setLoading(true);
        try {
            const lowStock = products.filter(p => p.stockLevel <= p.minStockLevel);
            const inventorySummary = products.map(p => ({
                name: p.nameEn,
                stock: p.stockLevel,
                min: p.minStockLevel,
                category: p.category
            }));

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `As an expert pharmacy consultant, analyze this inventory data and provide 3 brief, actionable business insights (Myanmar/English mixed) for Parami Pharmacy. Focus on stock optimization and reordering. Keep it professional but clear.
                Inventory Summary: ${JSON.stringify(inventorySummary.slice(0, 20))}
                Low Stock Count: ${lowStock.length}`,
                config: {
                    thinkingConfig: { thinkingBudget: 0 },
                    temperature: 0.7,
                    maxOutputTokens: 800,
                }
            });

            setInsight(response.text || "Unable to generate insights at this time.");
        } catch (error) {
            console.error("AI Insight Error:", error);
            setInsight("The AI Brain is busy optimizing data. Please ensure your API_KEY is set and try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none group-hover:scale-110 transition-transform">
                <BrainCircuit size={120} className="text-indigo-600" />
            </div>
            
            <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-lg shadow-indigo-200">
                        <Sparkles size={18} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">AI Stock Analyst</h3>
                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Powered by Gemini</p>
                    </div>
                </div>
                {!insight && !loading && (
                    <Button variant="outline" size="sm" onClick={generateInsight} className="border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50">
                        Generate Report
                    </Button>
                )}
            </div>

            <div className="relative z-10">
                {loading ? (
                    <div className="py-8 flex flex-col items-center justify-center text-indigo-600 animate-pulse">
                        <Loader2 className="animate-spin mb-2" size={32} />
                        <p className="text-xs font-bold uppercase tracking-wider">Analyzing Inventory...</p>
                    </div>
                ) : insight ? (
                    <div className="space-y-4">
                        <div className="text-sm text-slate-700 leading-relaxed font-mm whitespace-pre-wrap">
                            {insight}
                        </div>
                        <div className="pt-4 border-t border-indigo-100 flex justify-end">
                            <button onClick={() => setInsight(null)} className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 uppercase transition-colors">Dismiss</button>
                        </div>
                    </div>
                ) : (
                    <div className="py-4 text-center">
                        <p className="text-sm text-slate-500 italic">"I can analyze your stock levels and suggest reorders based on trends."</p>
                    </div>
                )}
            </div>
        </Card>
    );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { products } = useProductStore();
  const { customers } = useCustomerStore();
  const { transactions } = useTransactionStore();
  const { orders } = useDistributionStore();

  const [filterType, setFilterType] = useState<'Today' | 'Week' | 'Month' | 'Year'>('Month');
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalRevenue: 0,
    revenueGrowth: 0,
    lowStockCount: 0,
    totalCustomers: 0,
    recentTransactions: [],
    chartData: [],
    categoryData: []
  });

  const calculateMetrics = () => {
    setLoading(true);
    setTimeout(() => {
        const { start, end, prevStart, prevEnd } = getDateRange(filterType);
        const currentTrans = transactions.filter((t: any) => {
            const d = new Date(t.date);
            return t.type === 'INCOME' && d >= start && d <= end;
        });
        const prevTrans = transactions.filter((t: any) => {
            const d = new Date(t.date);
            return t.type === 'INCOME' && d >= prevStart && d <= prevEnd;
        });
        const isCompletedOrder = (status: string) => ['DELIVERED', 'COMPLETED'].includes(status);
        const currentOrders = orders.filter((o: any) => {
            const d = new Date(o.date);
            return isCompletedOrder(o.status) && d >= start && d <= end;
        });
        const prevOrders = orders.filter((o: any) => {
            const d = new Date(o.date);
            return isCompletedOrder(o.status) && d >= prevStart && d <= prevEnd;
        });
        const transRevenue = currentTrans.reduce((sum: number, t: any) => sum + t.amount, 0);
        const orderRevenue = currentOrders.reduce((sum: number, o: any) => sum + o.total, 0);
        const totalRevenue = transRevenue + orderRevenue;
        const prevTransRev = prevTrans.reduce((sum: number, t: any) => sum + t.amount, 0);
        const prevOrderRev = prevOrders.reduce((sum: number, o: any) => sum + o.total, 0);
        const prevTotalRevenue = prevTransRev + prevOrderRev;
        const growth = prevTotalRevenue === 0 ? 100 : ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100;
        const lowStock = products.filter(p => p.stockLevel <= (p.minStockLevel || 10)).length;
        const totalCust = customers.length;
        
        const chartMap = new Map<string, number>();
        const labelFormat = filterType === 'Today' ? 'hour' : filterType === 'Year' ? 'month' : 'day';
        const addToChart = (dateStr: string, amount: number) => {
            const date = new Date(dateStr);
            let key = '';
            if (labelFormat === 'hour') key = date.getHours() + ':00';
            else if (labelFormat === 'month') key = date.toLocaleString('default', { month: 'short' });
            else key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            chartMap.set(key, (chartMap.get(key) || 0) + amount);
        };
        currentTrans.forEach((t: any) => addToChart(t.date, t.amount));
        currentOrders.forEach((o: any) => addToChart(o.date, o.total));
        const chartData = Array.from(chartMap, ([name, revenue]) => ({ name, revenue }));
        
        const categoryMap = new Map<string, number>();
        currentTrans.forEach((t: any) => categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + t.amount));
        currentOrders.forEach((o: any) => {
            o.itemsList?.forEach((item: any) => {
                const product = products.find(p => p.nameEn === item.name);
                const cat = product?.category || 'Wholesale';
                categoryMap.set(cat, (categoryMap.get(cat) || 0) + (item.price * item.quantity));
            });
        });
        const categoryData = Array.from(categoryMap, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
        
        setMetrics({
            totalRevenue,
            revenueGrowth: growth,
            lowStockCount: lowStock,
            totalCustomers: totalCust,
            recentTransactions: [...currentTrans].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5),
            chartData,
            categoryData
        });
        setLastUpdated(new Date());
        setLoading(false);
    }, 600);
  };

  useEffect(() => { calculateMetrics(); }, [filterType, transactions, orders, products, customers]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Dashboard Overview</h1>
          <p className="text-slate-500 text-sm flex items-center gap-2 font-medium mt-1">
            Real-time business analytics
            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
            <span className="text-[10px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full text-slate-500">
               Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-3 items-center bg-white p-2 rounded-2xl shadow-sm border border-slate-200/60">
           <div className="flex bg-slate-100/80 p-1 rounded-xl">
              {(['Today', 'Week', 'Month', 'Year'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg capitalize transition-all ${
                    filterType === type 
                      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5' 
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                  }`}
                >
                  {type}
                </button>
              ))}
           </div>
           <Button variant="outline" onClick={calculateMetrics} disabled={loading} className="px-3 bg-white hover:bg-slate-50 border-slate-200 shadow-sm text-slate-600">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Total Revenue" 
            value={`${metrics.totalRevenue.toLocaleString()} MMK`} 
            subValue={`Based on ${filterType} Sales`}
            trend={metrics.revenueGrowth >= 0 ? 'up' : 'down'} 
            trendValue={`${Math.abs(metrics.revenueGrowth).toFixed(1)}%`} 
            icon={TrendingUp} 
            colorClass="bg-emerald-100" 
            onClick={() => navigate('/finance')}
          />
          <StatCard 
            title="Low Stock Items" 
            value={metrics.lowStockCount} 
            subValue="Stock <= Min Level"
            trend="down" 
            icon={AlertTriangle} 
            colorClass="bg-amber-100"
            onClick={() => navigate('/inventory?filter=low_stock')}
          />
          <StatCard 
            title="Total Customers" 
            value={metrics.totalCustomers.toLocaleString()} 
            subValue="Registered Members"
            trend="up" 
            icon={Users} 
            colorClass="bg-purple-100" 
            onClick={() => navigate('/customers')}
          />
          <div className="md:col-span-2 lg:col-span-1">
            <AIInsights />
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" title="Revenue Analytics">
          <div className="h-[320px] w-full mt-4">
            {metrics.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 500}} dy={10} minTickGap={30} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 500}} tickFormatter={(value) => `${value/1000}k`} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toLocaleString()} MMK`, 'Revenue']}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', padding: '12px' }}
                    itemStyle={{ color: '#3B82F6', fontWeight: 600, fontSize: '12px' }}
                    labelStyle={{ color: '#64748b', fontSize: '11px', marginBottom: '4px', fontWeight: 600 }}
                    cursor={{ stroke: '#3B82F6', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" animationDuration={1000} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
               <div className="h-full flex items-center justify-center text-slate-400 flex-col">
                  <Activity size={32} className="opacity-20 mb-2" />
                  <p>No revenue data for {filterType}</p>
               </div>
            )}
          </div>
        </Card>

        <Card title="Top Sales Categories">
          <div className="mt-4 h-[320px]">
            {metrics.categoryData.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={metrics.categoryData} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={90} tick={{fontSize: 11, fill: '#64748b', fontWeight: 600}} axisLine={false} tickLine={false} />
                    <Tooltip 
                      cursor={{fill: '#f8fafc', radius: 4}}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                      formatter={(value: number) => [`${value.toLocaleString()} Ks`, 'Sales']}
                    />
                    <Bar dataKey="value" barSize={24} radius={[0, 6, 6, 0]}>
                      {metrics.categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                 </BarChart>
               </ResponsiveContainer>
            ) : (
               <div className="h-full flex items-center justify-center text-slate-400 flex-col">
                  <ShoppingCart size={32} className="opacity-20 mb-2" />
                  <p>No category data available</p>
               </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
