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
  TooltipOptions,
  wrapItemChildren,
} from '../utils';

export interface ListViewFromChildrenProps extends ListViewPropsCommon {
  children: ItemElementOrPrimitive | ItemElementOrPrimitive[];
  tooltipOptions: TooltipOptions | null;
}

export const ListViewFromChildren = forwardRef<
  DOMRefValue<HTMLDivElement>,
  ListViewFromChildrenProps
>(
  (
    {
      children,
      selectedKeys,
      defaultSelectedKeys,
      disabledKeys,
      tooltipOptions,
      onChange,
      onSelectionChange,
      ...props
    },
    forwardedRef
  ): JSX.Element => {
    const wrappedChildren = useMemo(
      () => wrapItemChildren(children, tooltipOptions),
      [children, tooltipOptions]
    );

    return (
      <SpectrumListView
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...props}
        ref={forwardedRef}
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
