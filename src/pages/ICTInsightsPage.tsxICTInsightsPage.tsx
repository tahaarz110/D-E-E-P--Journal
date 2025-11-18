import React, { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line 
} from 'recharts';
import { getIctWinRates, getIctHeatmapData, transformHeatmapData, getWinRateColor, getWinRateTextColor } from '../utils/ictAnalysis';
import { IctWinRate, IctHeatmapData } from '../types/ict';

const ICTInsightsPage: React.FC = () => {
  const [winRates, setWinRates] = useState<IctWinRate[]>([]);
  const [heatmapData, setHeatmapData] = useState<IctHeatmapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'patterns' | 'heatmap' | 'trends'>('patterns');

  useEffect(() => {
    loadIctData();
  }, []);

  const loadIctData = async () => {
    try {
      setLoading(true);
      const [winRatesData, heatmapData] = await Promise.all([
        getIctWinRates(),
        getIctHeatmapData()
      ]);
      setWinRates(winRatesData);
      setHeatmapData(heatmapData);
      setError(null);
    } catch (err) {
      setError('Failed to load ICT analysis data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const { transformed: heatmapTransformed, patterns, daysOfWeek } = transformHeatmapData(heatmapData);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
          <p className="font-bold">{label}</p>
          <p className="text-blue-600">
            Win Rate: <strong>{payload[0].value}%</strong>
          </p>
          {payload[0].payload.total_trades && (
            <p className="text-gray-600">
              Total Trades: <strong>{payload[0].payload.total_trades}</strong>
            </p>
          )}
          {payload[0].payload.winning_trades && (
            <p className="text-green-600">
              Winning Trades: <strong>{payload[0].payload.winning_trades}</strong>
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const renderPatternAnalysis = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Win Rate Bar Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">ICT Pattern Win Rates</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={winRates}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="pattern" />
                <YAxis label={{ value: 'Win Rate %', angle: -90, position: 'insideLeft' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="win_rate" name="Win Rate %" fill="#8884d8">
                  {winRates.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getWinRateColor(entry.win_rate).replace('bg-', '')} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pattern Distribution Pie Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Pattern Distribution</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={winRates}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ pattern, total_trades }) => `${pattern}: ${total_trades}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="total_trades"
                  nameKey="pattern"
                >
                  {winRates.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getWinRateColor(entry.win_rate).replace('bg-', '')} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Pattern Statistics Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Pattern Performance Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pattern
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Trades
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Winning Trades
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Win Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Performance
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {winRates.map((pattern) => (
                <tr key={pattern.pattern} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {pattern.pattern}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {pattern.total_trades}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {pattern.winning_trades}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`font-bold ${getWinRateTextColor(pattern.win_rate)}`}>
                      {pattern.win_rate}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full ${getWinRateColor(pattern.win_rate)}`}
                        style={{ width: `${Math.min(pattern.win_rate, 100)}%` }}
                      ></div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderHeatmap = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Pattern Performance Heatmap</h3>
        <p className="text-gray-600 mb-4">
          Win rates by ICT pattern and day of the week. Darker green indicates higher win rates.
        </p>
        
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                <th className="px-4 py-3 bg-gray-50 border border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pattern / Day
                </th>
                {daysOfWeek.map(day => (
                  <th key={day} className="px-4 py-3 bg-gray-50 border border-gray-200 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {patterns.map(pattern => (
                <tr key={pattern} className="hover:bg-gray-50">
                  <td className="px-4 py-3 border border-gray-200 text-sm font-medium text-gray-900 bg-gray-50">
                    {pattern}
                  </td>
                  {daysOfWeek.map(day => {
                    const data = heatmapData.find(d => d.pattern === pattern && d.day_of_week === day);
                    const winRate = data ? data.win_rate : 0;
                    return (
                      <td 
                        key={`${pattern}-${day}`}
                        className={`px-4 py-3 border border-gray-200 text-center text-sm ${getWinRateColor(winRate)} text-white font-medium`}
                        title={`${pattern} on ${day}: ${winRate}% win rate (${data?.total_trades || 0} trades)`}
                      >
                        {winRate > 0 ? `${winRate}%` : '-'}
                        {data?.total_trades && (
                          <div className="text-xs opacity-75">{data.total_trades} trades</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Heatmap Legend */}
        <div className="mt-6 flex items-center justify-center space-x-4">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-red-400 mr-2"></div>
            <span className="text-xs text-gray-600">Low Win Rate (&lt;40%)</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-orange-400 mr-2"></div>
            <span className="text-xs text-gray-600">Medium (40-50%)</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-yellow-400 mr-2"></div>
            <span className="text-xs text-gray-600">Good (50-60%)</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-400 mr-2"></div>
            <span className="text-xs text-gray-600">Very Good (60-70%)</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-500 mr-2"></div>
            <span className="text-xs text-gray-600">Excellent (&gt;70%)</span>
          </div>
        </div>
      </div>

      {/* Heatmap Chart Visualization */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Heatmap Chart View</h3>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={heatmapTransformed}
              layout="vertical"
              margin={{ top: 20, right: 30, left: 100, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} label={{ value: 'Win Rate %', position: 'insideBottom', offset: -5 }} />
              <YAxis type="category" dataKey="pattern" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {daysOfWeek.map((day, index) => (
                <Bar 
                  key={day}
                  dataKey={day}
                  stackId="a"
                  fill={`hsl(${index * 50}, 70%, 50%)`}
                  name={day}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const renderTrends = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Pattern Performance Trends</h3>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={winRates}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="pattern" />
              <YAxis label={{ value: 'Win Rate %', angle: -90, position: 'insideLeft' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="win_rate" 
                stroke="#8884d8" 
                strokeWidth={2}
                name="Win Rate %"
                dot={{ fill: '#8884d8', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Key Insights */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-blue-800 mb-3">Key Insights</h4>
          <ul className="text-sm text-blue-700 space-y-2">
            <li>• Best performing pattern: {winRates[0]?.pattern || 'N/A'}</li>
            <li>• Worst performing pattern: {winRates[winRates.length - 1]?.pattern || 'N/A'}</li>
            <li>• Average win rate across all patterns: {winRates.length > 0 ? (winRates.reduce((sum, p) => sum + p.win_rate, 0) / winRates.length).toFixed(1) + '%' : 'N/A'}</li>
            <li>• Most traded pattern: {winRates.length > 0 ? winRates.reduce((max, p) => p.total_trades > max.total_trades ? p : max).pattern : 'N/A'}</li>
          </ul>
        </div>

        {/* Recommendations */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-green-800 mb-3">Trading Recommendations</h4>
          <ul className="text-sm text-green-700 space-y-2">
            <li>• Focus on high win-rate patterns</li>
            <li>• Avoid patterns with consistent losses</li>
            <li>• Consider day-of-week performance</li>
            <li>• Combine multiple high-performing patterns</li>
          </ul>
        </div>

        {/* Risk Management */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-yellow-800 mb-3">Risk Management</h4>
          <ul className="text-sm text-yellow-700 space-y-2">
            <li>• Adjust position size based on pattern performance</li>
            <li>• Use tighter stops on low win-rate patterns</li>
            <li>• Consider pattern-specific risk parameters</li>
            <li>• Monitor pattern performance regularly</li>
          </ul>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-600">Loading ICT insights...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">ICT Insights</h1>
        <button
          onClick={loadIctData}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-primary-700"
        >
          Refresh Data
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('patterns')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'patterns'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Pattern Analysis
          </button>
          <button
            onClick={() => setActiveTab('heatmap')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'heatmap'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Performance Heatmap
          </button>
          <button
            onClick={() => setActiveTab('trends')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'trends'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Trends & Insights
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="pt-4">
        {activeTab === 'patterns' && renderPatternAnalysis()}
        {activeTab === 'heatmap' && renderHeatmap()}
        {activeTab === 'trends' && renderTrends()}
      </div>
    </div>
  );
};

export default ICTInsightsPage;