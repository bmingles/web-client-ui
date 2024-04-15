import { cloneElement, ReactElement, ReactNode } from 'react';
import { Icon, Item } from '@adobe/react-spectrum';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { dh as dhIcons } from '@deephaven/icons';
import { NON_BREAKING_SPACE } from '@deephaven/utils';
import { Text } from '../Text';
import {
  isItemElement,
  isSectionElement,
  ItemElement,
  ItemIconSlot,
  ItemOrSection,
  SectionElement,
} from './itemUtils';
import { ItemProps } from '../shared';

/**
 * If the given content is a primitive type, wrap it in a Text component.
 * @param content The content to wrap
 * @param slot The slot to use for the Text component
 * @returns The wrapped content or original content if not a primitive type
 */
export function wrapPrimitiveWithText(
  content?: ReactNode,
  slot?: string
): ReactNode {
  // eslint-disable-next-line no-param-reassign
  content = content ?? '';

  if (['string', 'boolean', 'number'].includes(typeof content)) {
    return (
      <Text slot={slot}>
        {content === '' ? NON_BREAKING_SPACE : String(content)}
      </Text>
    );
  }

  return content;
}

/**
 * If the given content is a string, wrap it in an Icon component. Otherwise,
 * return the original content. If the key is not found in the dhIcons object,
 * the vsBlank icon will be used.
 * @param maybeIconKey The content to wrap
 * @param slot The slot to use for the Icon component
 * @returns The wrapped content or original content if not a string
 */
export function wrapIcon(
  maybeIconKey: ReactNode,
  slot: ItemIconSlot
): ReactNode {
  // eslint-disable-next-line no-param-reassign
  maybeIconKey = maybeIconKey ?? '';

  if (typeof maybeIconKey !== 'string') {
    return maybeIconKey;
  }

  return (
    <Icon slot={slot}>
      <FontAwesomeIcon icon={dhIcons[maybeIconKey] ?? dhIcons.vsBlank} />
    </Icon>
  );
}

export function normalizeAsItemElementList(
  itemsOrSections: ItemOrSection | ItemOrSection[]
): (ItemElement | SectionElement)[] {
  const itemsArray: ItemOrSection[] = Array.isArray(itemsOrSections)
    ? itemsOrSections
    : [itemsOrSections];

  return itemsArray.map(item => {
    if (isItemElement(item)) {
      return item;
    }

    if (isSectionElement(item)) {
      return cloneElement(item, {
        ...item.props,
        children: normalizeAsItemElementList(
          item.props.children
        ) as ReactElement<ItemProps<unknown>>[],
      });
    }

    if (
      typeof item === 'string' ||
      typeof item === 'number' ||
      typeof item === 'boolean'
    ) {
      const text = String(item);
      return (
        <Item key={text} textValue={text}>
          <Text>{text}</Text>
        </Item>
      );
    }

    return item;
  });
}
