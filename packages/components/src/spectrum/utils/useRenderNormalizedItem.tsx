import { Key, useCallback } from 'react';

import { ItemContent } from '../ItemContent';
import { Item } from '../shared';
import {
  getItemKey,
  ItemIconSlot,
  NormalizedItem,
  TooltipOptions,
} from './itemUtils';
import { wrapIcon, wrapPrimitiveWithText } from './itemWrapperUtils';

export interface UseRenderNormalizedItemOptions {
  itemIconSlot: ItemIconSlot;
  showItemDescriptions: boolean;
  showItemIcons: boolean;
  tooltipOptions: TooltipOptions | null;
}

/**
 * Returns a render function that can be used to render a normalized item in
 * collection components.
 * @param itemIconSlot Slot to use for the item icon
 * @param showItemDescriptions Whether to show descriptions in the item
 * @param showItemIcons Whether to show icons in the item
 * @param tooltipOptions Tooltip options to use when rendering the item
 * @returns Render function for normalized items
 */
export function useRenderNormalizedItem({
  itemIconSlot,
  showItemDescriptions,
  showItemIcons,
  tooltipOptions,
}: UseRenderNormalizedItemOptions): (
  normalizedItem: NormalizedItem
) => JSX.Element {
  return useCallback(
    (normalizedItem: NormalizedItem) => {
      const key = getItemKey(normalizedItem);
      const content = wrapPrimitiveWithText(normalizedItem.item?.content);
      const textValue = normalizedItem.item?.textValue ?? '';

      const description = showItemDescriptions
        ? wrapPrimitiveWithText(normalizedItem.item?.description, 'description')
        : null;

      const icon = showItemIcons
        ? wrapIcon(normalizedItem.item?.icon, itemIconSlot)
        : null;

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
    [itemIconSlot, showItemDescriptions, showItemIcons, tooltipOptions]
  );
}

export default useRenderNormalizedItem;
