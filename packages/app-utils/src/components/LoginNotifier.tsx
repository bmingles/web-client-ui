import { useBroadcastChannel } from '@deephaven/jsapi-components';
import { BROADCAST_LOGIN_MESSAGE } from '@deephaven/jsapi-utils';
import { makeMessage } from '@deephaven/utils';
import { useEffect } from 'react';

/**
 * Component that broadcasts a message when mounted. Should be mounted after the user has logged in.
 */
export function LoginNotifier(): JSX.Element | null {
  const channel = useBroadcastChannel();
  useEffect(
    function notifyLogin() {
      channel.postMessage(makeMessage(BROADCAST_LOGIN_MESSAGE));
    },
    [channel]
  );
  return null;
}

export default LoginNotifier;
