import { useMemo } from 'react';
import { Flex } from '@adobe/react-spectrum';
import { EMPTY_FUNCTION } from '@deephaven/utils';
import {
  extractSpectrumHTMLElement,
  useContentRect,
  useOnScrollRef,
} from '@deephaven/react-hooks';
import cl from 'classnames';
import {
  isNormalizedItemsWithKeysList,
  normalizeTooltipOptions,
  TooltipOptions,
} from '../utils';
import ListViewFromChildren, {
  ListViewFromChildrenProps,
} from './ListViewFromChildren';
import ListViewFromItems, { ListViewFromItemsProps } from './ListViewFromItems';
import { ListViewPropsCommon } from './ListViewModel';

export type ListViewProps = {
  /** Can be set to true or a TooltipOptions to enable item tooltips */
  tooltip?: boolean | TooltipOptions;

  /** Handler that is called when the picker is scrolled. */
  onScroll?: (event: Event) => void;
} & ListViewPropsCommon &
  (
    | { children: ListViewFromChildrenProps['children'] }
    | {
        children: ListViewFromItemsProps['items'];
        showItemDescriptions: boolean;
        showItemIcons: boolean;
      }
  );

export function ListView({
  UNSAFE_className,
  onScroll = EMPTY_FUNCTION,
  children,
  tooltip,
  ...props
}: ListViewProps): JSX.Element | null {
  const tooltipOptions = useMemo(
    () => normalizeTooltipOptions(tooltip, 'bottom'),
    [tooltip]
  );

  const scrollRef = useOnScrollRef(onScroll, extractSpectrumHTMLElement);

  // Spectrum ListView crashes when it has zero height. Track the contentRect
  // of the parent container and only render the ListView when it has a non-zero
  // height.
  const { ref: contentRectRef, contentRect } = useContentRect(
    extractSpectrumHTMLElement
  );

  const listView = useMemo(
    () =>
      isNormalizedItemsWithKeysList(children) ? (
        <ListViewFromItems
          // eslint-disable-next-line react/jsx-props-no-spreading
          {...(props as ListViewFromItemsProps)}
          ref={scrollRef}
          items={children}
          tooltipOptions={tooltipOptions}
        />
      ) : (
        <ListViewFromChildren
          // eslint-disable-next-line react/jsx-props-no-spreading
          {...props}
          ref={scrollRef}
          tooltipOptions={tooltipOptions}
        >
          {children}
        </ListViewFromChildren>
      ),
    [children, props, scrollRef, tooltipOptions]
  );

  return (
    <Flex
      ref={contentRectRef}
      direction="column"
      flex={props.flex ?? 1}
      minHeight={0}
      UNSAFE_className={cl('dh-list-view', UNSAFE_className)}
    >
      {contentRect.height === 0 ? (
        // Use &nbsp; to ensure content has a non-zero height. This ensures the
        // container will also have a non-zero height unless its height is
        // explicitly set to zero. Example use case:
        // 1. Tab containing ListView is visible. Container height is non-zero.
        //    ListView is rendered.
        // 2. Tab is hidden. Container height is explicitly constrained to zero.
        //    ListView is not rendered.
        // 3. Tab is shown again. Height constraint is removed. Resize observer
        //    fires and shows non-zero height due to the &nbsp; (without this,
        //    the height would remain zero forever since ListView hasn't rendered yet)
        // 4. ListView is rendered again.
        <>&nbsp;</>
      ) : (
        listView
      )}
    </Flex>
  );
}

export default ListView;
