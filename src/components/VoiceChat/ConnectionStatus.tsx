/**
 * ConnectionStatus Component
 * Visual connection status indicator
 */

import type { ConnectionState } from '../../lib/websocket';

interface ConnectionStatusProps {
  state: ConnectionState;
  error?: string;
}

export function ConnectionStatus({ state, error }: ConnectionStatusProps) {
  const getStatusColor = () => {
    switch (state) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
      case 'reconnecting':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (state) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'reconnecting':
        return 'Reconnecting...';
      case 'error':
        return 'Error';
      default:
        return 'Disconnected';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
      <span className="text-sm text-gray-700 dark:text-gray-300">
        {getStatusText()}
      </span>
      {error && (
        <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  );
}

