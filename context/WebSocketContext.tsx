import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import { TeamNotification } from '@/lib/notifications';

interface WebSocketContextType {
  isConnected: boolean;
  notifications: TeamNotification[];
  unreadCount: number;
  joinTeam: (teamId: number) => void;
  leaveTeam: (teamId: number) => void;
  sendTeamAction: (teamId: number, action: string, payload: any) => void;
  markNotificationAsRead: (notificationId: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  
  const webSocketData = useWebSocket(user ? token : null);

  // Auto-join team when user has a team
  useEffect(() => {
    if (webSocketData.isConnected && user?.teamId) {
      webSocketData.joinTeam(user.teamId);
    }
  }, [webSocketData.isConnected, user?.teamId]);

  if (!user) {
    // Return a mock context for non-authenticated users
    return (
      <WebSocketContext.Provider value={{
        isConnected: false,
        notifications: [],
        unreadCount: 0,
        joinTeam: () => {},
        leaveTeam: () => {},
        sendTeamAction: () => {},
        markNotificationAsRead: () => {}
      }}>
        {children}
      </WebSocketContext.Provider>
    );
  }

  return (
    <WebSocketContext.Provider value={webSocketData}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
}
