import Log from '@deephaven/log';

const log = Log.module('errorNotification');

/**
 * JSON RPC 2.0 notification for logging messages to the host
 * Per MCP Apps SDK: https://modelcontextprotocol.github.io/ext-apps/api/classes/app.App.html#sendLog
 * Per MCP Apps spec: https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/draft/apps.mdx#standard-mcp-messages
 */
interface JsonRpcLogNotification {
  jsonrpc: '2.0';
  method: 'notifications/message';
  params: {
    level:
      | 'error'
      | 'alert'
      | 'debug'
      | 'info'
      | 'notice'
      | 'warning'
      | 'critical'
      | 'emergency';
    logger?: string;
    data: unknown;
  };
}

/**
 * Send a JSON RPC 2.0 notification to log an error to the parent window.
 * This allows the MCP App SDK host to be notified of errors in the iframe.
 * Only sends if the 'errorNotifications' query parameter is present.
 * @param errorData The error data to send
 * @param logger Optional logger name (defaults to 'errorNotification')
 */
export function sendErrorNotificationToParent(
  errorData: {
    message: string;
    stack?: string;
    componentStack?: string;
  },
  logger = 'errorNotification'
): void {
  try {
    // Check if error notifications are enabled via query parameter
    const searchParams = new URLSearchParams(window.location.search);
    if (!searchParams.has('errorNotifications')) {
      return;
    }

    const notification: JsonRpcLogNotification = {
      jsonrpc: '2.0',
      method: 'notifications/message',
      params: {
        level: 'error',
        logger,
        data: {
          message: errorData.message,
          ...(errorData.stack != null && { stack: errorData.stack }),
          ...(errorData.componentStack != null && {
            componentStack: errorData.componentStack,
          }),
        },
      },
    };

    log.debug('[TESTING] sendErrorNotificationToParent', notification);

    // Send to parent window if running in iframe
    if (window.parent !== window) {
      window.parent.postMessage(notification, '*');
      log.debug('Sent error notification to parent window', notification);
    }
  } catch (err) {
    // Silently fail if postMessage fails to avoid cascading errors
    log.error('Failed to send error notification to parent', err);
  }
}

export default sendErrorNotificationToParent;
