import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { useNavigate } from 'react-router-dom';
import DynamicTable from '../components/DynamicTable/DynamicTable';
import { Trade } from '../types/trade';

const TradeListPage: React.FC = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterResult, setFilterResult] = useState<string>('all');
  const [useDynamicTable, setUseDynamicTable] = useState(true);
  const [selectedTrades, setSelectedTrades] = useState<number[]>([]);
  const navigate = useNavigate();

  const fetchTrades = async () => {
    try {
      setLoading(true);
      const fetchedTrades: Trade[] = await invoke('get_all_trades');
      setTrades(fetchedTrades);
      setError(null);
    } catch (err) {
      setError('Failed to fetch trades. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();
  }, []);

  const handleDelete = async (tradeId: number) => {
    if (!window.confirm('Are you sure you want to delete this trade?')) {
      return;
    }

    try {
      await invoke('delete_trade', { id: tradeId });
      await fetchTrades();
    } catch (err) {
      setError('Failed to delete trade. Please try again.');
      console.error(err);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTrades.length === 0) {
      alert('Please select trades to delete');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedTrades.length} trades?`)) {
      return;
    }

    try {
      for (const tradeId of selectedTrades) {
        await invoke('delete_trade', { id: tradeId });
      }
      setSelectedTrades([]);
      await fetchTrades();
    } catch (err) {
      setError('Failed to delete trades. Please try again.');
      console.error(err);
    }
  };

  const handleEdit = (trade: Trade) => {
    // Navigate to edit page or open modal
    console.log('Edit trade:', trade);
    alert(`Edit trade ${trade.id} - This feature will be implemented in the next phase`);
  };

  const handleView = (trade: Trade) => {
    // Navigate to view details page or open modal
    console.log('View trade:', trade);
    alert(`View trade details for ${trade.symbol} - This feature will be implemented in the next phase`);
  };

  const handleAddTrade = () => {
    navigate('/add-trade');
  };

  const handleTradeSelect = (tradeId: number, checked: boolean) => {
    if (checked) {
      setSelectedTrades(prev => [...prev, tradeId]);
    } else {
      setSelectedTrades(prev => prev.filter(id => id !== tradeId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTrades(filteredTrades.map(trade => trade.id));
    } else {
      setSelectedTrades([]);
    }
  };

  // Filter trades based on search and filters
  const filteredTrades = trades.filter(trade => {
    const matchesSearch = trade.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         trade.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || trade.trade_type === filterType;
    
    const matchesResult = filterResult === 'all' || 
                         (filterResult === 'win' && trade.is_win === true) ||
                         (filterResult === 'loss' && trade.is_win === false) ||
                         (filterResult === 'open' && trade.is_win === null);

    return matchesSearch && matchesType && matchesResult;
  });

  const calculateStats = () => {
    const total = filteredTrades.length;
    const wins = filteredTrades.filter(t => t.is_win === true).length;
    const losses = filteredTrades.filter(t => t.is_win === false).length;
    const open = filteredTrades.filter(t => t.is_win === null).length;
    const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0';

    return { total, wins, losses, open, winRate };
  };

  const stats = calculateStats();

  const renderTraditionalTable = () => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <input
                  type="checkbox"
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  checked={selectedTrades.length === filteredTrades.length && filteredTrades.length > 0}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Symbol
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Entry Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Volume
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                SL/TP
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Result
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Entry Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredTrades.map((trade) => (
              <tr key={trade.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedTrades.includes(trade.id)}
                    onChange={(e) => handleTradeSelect(trade.id, e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {trade.symbol}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    trade.trade_type === 'Buy' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {trade.trade_type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {trade.entry_price}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {trade.volume}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {trade.sl} / {trade.tp}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {trade.is_win === true && (
                    <span className="text-green-600 font-medium">Win</span>
                  )}
                  {trade.is_win === false && (
                    <span className="text-red-600 font-medium">Loss</span>
                  )}
                  {trade.is_win === null && (
                    <span className="text-yellow-600 font-medium">Open</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(trade.entry_time).toLocaleDateString()} {new Date(trade.entry_time).toLocaleTimeString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => handleView(trade)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleEdit(trade)}
                    className="text-primary-600 hover:text-primary-900"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(trade.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Trade List</h1>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500 flex items-center space-x-2">
            <span>Total: {stats.total}</span>
            <span className="text-green-600">Wins: {stats.wins}</span>
            <span className="text-red-600">Losses: {stats.losses}</span>
            <span className="text-yellow-600">Open: {stats.open}</span>
            <span>Win Rate: {stats.winRate}%</span>
          </div>
          <button
            onClick={handleAddTrade}
            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-primary-700"
          >
            Add Trade
          </button>
        </div>
      </div>

      {/* Controls Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-4">
            {/* Search */}
            <div className="flex items-center">
              <input
                type="text"
                placeholder="Search symbols or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center space-x-4">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">All Types</option>
                <option value="Buy">Buy Only</option>
                <option value="Sell">Sell Only</option>
              </select>

              <select
                value={filterResult}
                onChange={(e) => setFilterResult(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">All Results</option>
                <option value="win">Wins Only</option>
                <option value="loss">Losses Only</option>
                <option value="open">Open Only</option>
              </select>
            </div>

            {/* Bulk Actions */}
            {selectedTrades.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">
                  {selectedTrades.length} selected
                </span>
                <button
                  onClick={handleBulkDelete}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                >
                  Delete Selected
                </button>
              </div>
            )}
          </div>

          {/* Dynamic Table Toggle */}
          <div className="flex items-center">
            <label className="flex items-center text-sm text-gray-700">
              <input
                type="checkbox"
                checked={useDynamicTable}
                onChange={(e) => setUseDynamicTable(e.target.checked)}
                className="mr-2"
              />
              Use Dynamic Table
            </label>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-lg text-gray-600">Loading trades...</div>
        </div>
      ) : filteredTrades.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-gray-500 text-lg mb-2">No trades found</div>
          <button
            onClick={handleAddTrade}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            Add Your First Trade
          </button>
        </div>
      ) : useDynamicTable ? (
        <DynamicTable
          entityName="Trade"
          data={filteredTrades}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onView={handleView}
        />
      ) : (
        renderTraditionalTable()
      )}
    </div>
  );
};

export default TradeListPage;