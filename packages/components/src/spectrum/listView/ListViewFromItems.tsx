import { forwardRef } from 'react';
import { ListView as SpectrumListView } from '@adobe/react-spectrum';
import type { DOMRefValue } from '@react-types/shared';
import {
  NormalizedItem,
  TooltipOptions,
  useRenderNormalizedItem,
  useStringifiedMultiSelection,
} from '../utils';
import { ListViewPropsCommon } from './ListViewModel';

export interface ListViewFromItemsProps extends ListViewPropsCommon {
  items: NormalizedItem[];
  showItemDescriptions: boolean;
  showItemIcons: boolean;
  tooltipOptions: TooltipOptions | null;
}

export const ListViewFromItems = forwardRef<
  DOMRefValue<HTMLDivElement>,
  ListViewFromItemsProps
>(
  (
    {
      selectedKeys,
      defaultSelectedKeys,
      disabledKeys,
      showItemDescriptions,
      showItemIcons,
      tooltipOptions,
      items: normalizedItems,
      onChange,
      onSelectionChange,
      ...props
    },
    forwardedRef
  ): JSX.Element => {
    const renderNormalizedItem = useRenderNormalizedItem({
      itemIconSlot: 'image',
      showItemDescriptions,
      showItemIcons,
      tooltipOptions,
    });

    const {
      selectedStringKeys,
      defaultSelectedStringKeys,
      disabledStringKeys,
      onStringSelectionChange,
    } = useStringifiedMultiSelection({
      normalizedItems,
      selectedKeys,
      defaultSelectedKeys,
      disabledKeys,
      onChange: onChange ?? onSelectionChange,
    });

    return (
      <SpectrumListView
        // Spectrum doesn't re-render if only the `renderNormalizedItems` function
        // changes, so we have to force a re-render by changing the key.
        key={`${showItemIcons}-${showItemDescriptions}-${tooltipOptions?.placement}`}
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...props}
        ref={forwardedRef}
        items={normalizedItems}
        selectedKeys={selectedStringKeys}
        defaultSelectedKeys={defaultSelectedStringKeys}
        disabledKeys={disabledStringKeys}
        onSelectionChange={onStringSelectionChange}
      >
        {renderNormalizedItem}
      </SpectrumListView>
    );
  }
);

ListViewFromItems.displayName = 'ListViewFromItems';

export default ListViewFromItems;
