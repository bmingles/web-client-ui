import { Children, cloneElement, ReactElement, ReactNode } from 'react';
import cl from 'classnames';
import { isElementOfType } from '@deephaven/react-hooks';
import { TooltipOptions } from './utils';
import { Tooltip } from '../popper';
import { Flex } from './layout';
import { Text, TextProps } from './Text';
import './ItemTooltip.scss';

export interface ItemTooltipProps {
  children: ReactNode;
  options: TooltipOptions;
}

/**
 * Tooltip for `<Item>` content.
 */
export function ItemTooltip({
  children,
  options,
}: ItemTooltipProps): JSX.Element {
  if (Array.isArray(children)) {
    // Multiple children scenarios include a `<Text>` node for the label and at
    // least 1 of an optional icon or `<Text slot="description">` node. In such
    // cases we only show the label and description `<Text>` nodes.
    const textElements: ReactElement<TextProps>[] = children.filter(node =>
      isElementOfType(node, Text)
    );

    return (
      <Tooltip popperClassName="dh-item-tooltip" options={options}>
        <Flex direction="column" alignItems="start">
          {Children.map(textElements, textEl =>
            textEl.props.slot === 'description'
              ? cloneElement(textEl, {
                  ...textEl.props,
                  UNSAFE_className: cl(
                    textEl.props.UNSAFE_className,
                    'dh-item-tooltip-description'
                  ),
                })
              : textEl
          )}
        </Flex>
      </Tooltip>
    );
  }

  return <Tooltip options={options}>{children}</Tooltip>;
}

export default ItemTooltip;
