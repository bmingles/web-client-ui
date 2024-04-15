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
      items,
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
      normalizedItems: items,
      selectedKeys,
      defaultSelectedKeys,
      disabledKeys,
      onChange: onChange ?? onSelectionChange,
    });

    return (
      <SpectrumListView
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...props}
        ref={forwardedRef}
        items={items}
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
