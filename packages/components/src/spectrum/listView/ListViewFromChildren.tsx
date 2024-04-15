import { forwardRef, useMemo } from 'react';
import {
  ListView as SpectrumListView,
  SpectrumListViewProps,
} from '@adobe/react-spectrum';
import type { DOMRefValue } from '@react-types/shared';
import type { ListViewPropsCommon } from './ListViewModel';
import {
  ItemElementOrPrimitive,
  ItemKey,
  normalizeAsItemElementList,
  TooltipOptions,
} from '../utils';

export interface ListViewFromChildrenProps extends ListViewPropsCommon {
  tooltipOptions: TooltipOptions | null;
  children: ItemElementOrPrimitive | ItemElementOrPrimitive[];
}

export const ListViewFromChildren = forwardRef<
  DOMRefValue<HTMLDivElement>,
  ListViewFromChildrenProps
>(
  ({
    children,
    selectedKeys,
    defaultSelectedKeys,
    disabledKeys,
    tooltipOptions,
    onChange,
    onSelectionChange,
    ...props
  }): JSX.Element => {
    const wrappedChildren = useMemo(
      () => normalizeAsItemElementList(children),
      [children]
    );

    return (
      <SpectrumListView
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...props}
        selectedKeys={
          selectedKeys as SpectrumListViewProps<ItemKey>['selectedKeys']
        }
        defaultSelectedKeys={
          defaultSelectedKeys as SpectrumListViewProps<ItemKey>['defaultSelectedKeys']
        }
        disabledKeys={
          disabledKeys as SpectrumListViewProps<ItemKey>['disabledKeys']
        }
        onSelectionChange={onChange ?? onSelectionChange}
      >
        {wrappedChildren}
      </SpectrumListView>
    );
  }
);

ListViewFromChildren.displayName = 'ListViewFromChildren';

export default ListViewFromChildren;
