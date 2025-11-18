import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

interface NavigationItem {
  name: string;
  path: string;
  icon: string;
}

const navigationItems: NavigationItem[] = [
  { name: 'Dashboard', path: '/', icon: '📊' },
  { name: 'Trade List', path: '/trades', icon: '📋' },
  { name: 'Add Trade', path: '/add-trade', icon: '➕' },
  { name: 'ICT Insights', path: '/ict-insights', icon: '🔍' },
  { name: 'Plugins', path: '/plugins', icon: '🧩' },
  { name: 'Schema Manager', path: '/schema', icon: '🛠️' },
  { name: 'Settings', path: '/settings', icon: '⚙️' },
];

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { isRTL } = useTheme();
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <aside className={`bg-gray-800 dark:bg-gray-900 text-white ${collapsed ? 'w-20' : 'w-64'} transition-all duration-300 fixed left-0 top-0 bottom-0 z-40`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-8">
          {!collapsed && (
            <h2 className="text-xl font-bold">Trading Journal</h2>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (isRTL ? '←' : '→') : (isRTL ? '→' : '←')}
          </button>
        </div>
        
        <nav>
          <ul className="space-y-2">
            {navigationItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                    location.pathname === item.path
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                  title={collapsed ? item.name : undefined}
                >
                  <span className="text-lg" style={isRTL ? { marginLeft: '12px', marginRight: '0' } : { marginRight: '12px' }}>
                    {item.icon}
                  </span>
                  {!collapsed && <span>{item.name}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;