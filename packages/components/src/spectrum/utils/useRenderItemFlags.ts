import { useMemo } from 'react';
import {
  doesAnyItemHaveProp,
  NormalizedItem,
  NormalizedSection,
} from './itemUtils';

export interface UseRenderItemFlagsOptions {
  normalizedItems: (NormalizedSection | NormalizedItem)[];
  showItemIcons?: boolean;
  showItemDescriptions?: boolean;
}

export interface RenderItemFlags {
  showItemIcons: boolean;
  showItemDescriptions: boolean;
}

/**
 * Get flags for rendering items. Icons and descriptions need to be hidden or
 * shown for all items in a list. If `showItemIcons` or `showItemDescriptions`
 * are explicitly provided, use those values. Otherwise, if any item is found
 * with an icon or description, set the respective flag to true.
 * @param normalizedItems The normalized items to check for icons and descriptions
 * @param showItemIcons Whether to show item icons by default
 * @param showItemDescriptions Whether to show item descriptions by default
 * @returns Flags for rendering items
 */
export function useRenderItemFlags({
  normalizedItems,
  showItemIcons: showItemIconsDefault,
  showItemDescriptions: showItemDescriptionsDefault,
}: UseRenderItemFlagsOptions): RenderItemFlags {
  const showItemIcons = useMemo(
    () => showItemIconsDefault ?? doesAnyItemHaveProp(normalizedItems, 'icon'),
    [normalizedItems, showItemIconsDefault]
  );

  const showItemDescriptions = useMemo(
    () =>
      showItemDescriptionsDefault ??
      doesAnyItemHaveProp(normalizedItems, 'description'),
    [normalizedItems, showItemDescriptionsDefault]
  );

  return { showItemIcons, showItemDescriptions };
}

export default useRenderItemFlags;
