import { ReactNode } from 'react';
import { Icon } from '@adobe/react-spectrum';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { dh as dhIcons } from '@deephaven/icons';
import { NON_BREAKING_SPACE } from '@deephaven/utils';
import { Text } from '../Text';
import { ItemIconSlot } from './itemUtils';

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
