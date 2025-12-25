/**
 * Notification container component
 */

import styled from 'styled-components';
import { useUIStore } from '../../stores/ui';
import { colors, spacing } from '../../theme';

const Container = styled.div`
  position: fixed;
  top: ${spacing.xl};
  right: ${spacing.xl};
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
  pointer-events: none;
`;

const Notification = styled.div<{ type: 'success' | 'error' | 'info' | 'warning' }>`
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-left: 4px solid ${({ type }) => {
    switch (type) {
      case 'success': return colors.success;
      case 'error': return colors.danger;
      case 'warning': return colors.warning;
      case 'info': return colors.info;
      default: return colors.border;
    }
  }};
  padding: ${spacing.md};
  border-radius: 4px;
  min-width: 300px;
  max-width: 400px;
  pointer-events: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  animation: slideIn 0.3s ease;
  
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;

const Message = styled.div`
  color: ${colors.text};
  font-size: 0.875rem;
`;

export function NotificationContainer() {
    const notifications = useUIStore((state) => state.notifications);
    const removeNotification = useUIStore((state) => state.removeNotification);

    return (
        <Container>
            {notifications.map((notification) => (
                <Notification
                    key={notification.id}
                    type={notification.type}
                    onClick={() => removeNotification(notification.id)}
                >
                    <Message>{notification.message}</Message>
                </Notification>
            ))}
        </Container>
    );
}

