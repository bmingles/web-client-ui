import { SpectrumListViewProps } from '@adobe/react-spectrum';
import type { ItemKey, ItemSelection, NormalizedItem } from '../utils';

export type ListViewPropsCommon = {
  selectedKeys?: 'all' | Iterable<ItemKey>;
  defaultSelectedKeys?: 'all' | Iterable<ItemKey>;
  disabledKeys?: Iterable<ItemKey>;

  /**
   * Handler that is called when the selection change.
   * Note that under the hood, this is just an alias for Spectrum's
   * `onSelectionChange`. We are renaming for better consistency with other
   * components.
   */
  onChange?: (keys: ItemSelection) => void;

  /**
   * Handler that is called when the selection changes.
   * @deprecated Use `onChange` instead
   */
  onSelectionChange?: (keys: ItemSelection) => void;
} & Omit<
  SpectrumListViewProps<NormalizedItem>,
  | 'children'
  | 'items'
  | 'selectedKeys'
  | 'defaultSelectedKeys'
  | 'disabledKeys'
  | 'onSelectionChange'
>;
