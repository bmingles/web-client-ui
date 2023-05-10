import { Key, useCallback, useMemo, useState } from 'react';
import type { WindowedListData } from '@deephaven/jsapi-utils';

export interface UseWindowedListDataOptions<T> {
  getKey?: (item: T) => Key;
}

export default function useWindowedListData<T>({
  getKey = defaultGetKey,
}: UseWindowedListDataOptions<T>): WindowedListData<T> {
  const [items, setItems] = useState<T[]>([]);

  const [selectedKeys, setSelectedKeys] = useState<'all' | Set<Key>>(
    () => new Set()
  );

  const matchKey = useCallback(
    (key: Key) => (item: T) => getKey(item) === key,
    [getKey]
  );

  const getItem = useCallback(
    (key: Key) => {
      const item = items.find(matchKey(key));

      if (item == null) {
        throw new Error(`No item found matching key: ${key}`);
      }

      return item;
    },
    [items, matchKey]
  );

  const insert = useCallback((index: number, ...values: T[]) => {
    setItems(prevItems => [
      ...prevItems.slice(0, index),
      ...values,
      ...prevItems.slice(index),
    ]);
  }, []);

  const append = useCallback((...values: T[]) => {
    setItems(prevItems => [...prevItems, ...values]);
  }, []);

  const remove = useCallback(
    (...keys: Key[]) => {
      const keySet = new Set(keys);
      setItems(prevItems => prevItems.filter(item => keySet.has(getKey(item))));
    },
    [getKey]
  );

  const update = useCallback(
    (key: Key, item: T) => {
      const i = items.findIndex(matchKey(key));
      if (i === -1) {
        return;
      }

      setItems(prevItems => [
        ...prevItems.slice(0, i),
        item,
        ...prevItems.slice(i + 1),
      ]);
    },
    [items, matchKey]
  );

  const bulkUpdate = useCallback(
    (itemMap: Map<Key, T>): void => {
      if (itemMap.size === 0) {
        return;
      }

      const indices: number[] = [];
      const indexMap = new Map<number, Key>();

      // eslint-disable-next-line no-restricted-syntax
      for (const key of itemMap.keys()) {
        const i = items.findIndex(matchKey(key));
        indices.push(i);
        indexMap.set(i, key);
      }

      indices.sort((a, b) => a - b);

      const newItems: T[] = [];

      items.forEach((item, i) => {
        if (indices[0] === i) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const key = indexMap.get(indices.shift()!)!;
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const newItem = itemMap.get(key)!;
          newItems.push(newItem);
        } else {
          newItems.push(item);
        }
      });
      console.log('[TESTING] bulkUpdate', newItems);
      setItems(newItems);
    },
    [items, matchKey]
  );

  const listData = useMemo(
    () => ({
      items,
      selectedKeys,
      append,
      bulkUpdate,
      getItem,
      insert,
      remove,
      setSelectedKeys,
      update,
    }),
    [append, bulkUpdate, getItem, insert, items, remove, selectedKeys, update]
  );

  return listData;
}

function defaultGetKey<T>(item: T): Key {
  const hasKey = item != null && typeof item === 'object' && 'key' in item;
  if (!hasKey) {
    throw new Error('Item does not have a `key` prop.');
  }

  return item.key as Key;
}
