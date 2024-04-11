import { Key, ReactNode, useCallback } from 'react';
import { Icon } from '@adobe/react-spectrum';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { dh as dhIcons } from '@deephaven/icons';
import { ItemContent } from '../ItemContent';
import { Item } from '../shared';
import {
  getItemKey,
  ItemIconSlot,
  NormalizedItem,
  TooltipOptions,
} from './itemUtils';
import { Text } from '../Text';

function wrapPrimitiveWithText(content?: ReactNode, slot?: string): ReactNode {
  if (['string', 'boolean', 'number'].includes(typeof content)) {
    return <Text slot={slot}>{String(content)}</Text>;
  }

  return content;
}

function wrapIcon(maybeIconKey: ReactNode, slot: ItemIconSlot): ReactNode {
  if (typeof maybeIconKey !== 'string') {
    return maybeIconKey;
  }

  return (
    <Icon slot={slot}>
      <FontAwesomeIcon icon={dhIcons[maybeIconKey] ?? dhIcons.vsBlank} />
    </Icon>
  );
}

/**
 * Returns a render function that can be used to render a normalized item in
 * collection components.
 * @param tooltipOptions Tooltip options to use when rendering the item
 * @returns Render function for normalized items
 */
export function useRenderNormalizedItem(
  itemIconSlot: 'icon' | 'image' | 'illustration',
  tooltipOptions: TooltipOptions | null
): (normalizedItem: NormalizedItem) => JSX.Element {
  return useCallback(
    (normalizedItem: NormalizedItem) => {
      const key = getItemKey(normalizedItem);
      const content = wrapPrimitiveWithText(normalizedItem.item?.content ?? '');
      const textValue = normalizedItem.item?.textValue ?? '';
      const description = wrapPrimitiveWithText(
        normalizedItem.item?.description,
        'description'
      );
      const icon = wrapIcon(normalizedItem.item?.icon, itemIconSlot);

      return (
        <Item
          // Note that setting the `key` prop explicitly on `Item` elements
          // causes the picker to expect `selectedKey` and `defaultSelectedKey`
          // to be strings. It also passes the stringified value of the key to
          // `onSelectionChange` handlers` regardless of the actual type of the
          // key. We can't really get around setting in order to support Windowed
          // data, so we'll need to do some manual conversion of keys to strings
          // in other components that use this hook.
          key={key as Key}
          // The `textValue` prop gets used to provide the content of `<option>`
          // elements that back the Spectrum Picker. These are not visible in the UI,
          // but are used for accessibility purposes, so we set to an arbitrary
          // 'Empty' value so that they are not empty strings.
          textValue={textValue === '' ? 'Empty' : textValue}
        >
          <ItemContent tooltipOptions={tooltipOptions}>
            {icon}
            {content}
            {description}
          </ItemContent>
        </Item>
      );
    },
    [itemIconSlot, tooltipOptions]
  );
}

export default useRenderNormalizedItem;
