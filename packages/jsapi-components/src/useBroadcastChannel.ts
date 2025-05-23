import { BROADCAST_CHANNEL_NAME } from '@deephaven/jsapi-utils';
import Log from '@deephaven/log';
import { EMPTY_FUNCTION, isMessage, type PostMessage } from '@deephaven/utils';
import { useEffect, useMemo } from 'react';

const log = Log.module('useBroadcastChannel');

export function useBroadcastChannel(
  onEvent: (event: MessageEvent<PostMessage<unknown>>) => void = EMPTY_FUNCTION,
  name = BROADCAST_CHANNEL_NAME
): BroadcastChannel {
  const channel = useMemo(() => new BroadcastChannel(name), [name]);
  useEffect(
    () => () => {
      channel.close();
    },
    [channel]
  );

  useEffect(() => {
    function handleEvent(event: MessageEvent): void {
      const { data } = event;
      if (!isMessage(data)) {
        log.debug('Ignoring non-deephaven message', data);
        return;
      }
      log.debug('event received', data);
      onEvent(event);
    }
    channel.addEventListener('message', handleEvent);
    return () => {
      channel.removeEventListener('message', handleEvent);
    };
  }, [channel, onEvent]);

  return channel;
}

export default useBroadcastChannel;
