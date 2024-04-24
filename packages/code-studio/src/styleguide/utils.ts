import { createElement, useCallback, useState } from 'react';
import cl from 'classnames';
import { Item, ItemElement, NormalizedItem } from '@deephaven/components';
import { dh as dhIcons } from '@deephaven/icons';

export const HIDE_FROM_E2E_TESTS_CLASS = 'hide-from-e2e-tests';
export const SAMPLE_SECTION_CLASS = 'sample-section';

/**
 * Generate a given number of `Item` elements.
 */
export function* generateItemElements(
  start: number,
  end: number
): Generator<ItemElement> {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const len = letters.length;

  for (let i = start; i <= end; i += 1) {
    const charI = i % len;
    let suffix = String(Math.floor(i / len));
    if (suffix === '0') {
      suffix = '';
    }
    const letter = letters[charI];
    const key = `${letter}${suffix}`;
    const content = `${letter.repeat(3)}${suffix}`;

    // eslint-disable-next-line react/no-children-prop
    yield createElement(Item, {
      key,
      textValue: content,
      children: content,
    });
  }
}

/**
 * Generate a given number of NormalizedItems.
 * @param count The number of items to generate
 */
export function* generateNormalizedItems(
  count: number,
  include: { descriptions?: boolean; icons?: boolean } = {}
): Generator<NormalizedItem> {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const len = letters.length;

  const iconKeys = Object.keys(dhIcons);

  for (let i = 0; i < count; i += 1) {
    const charI = i % len;
    let suffix = String(Math.floor(i / len));
    if (suffix === '0') {
      suffix = '';
    }
    const letter = letters[charI];
    const key = `${letter}${suffix}`;

    const icon =
      include.icons === true ? iconKeys[i % iconKeys.length] : undefined;

    const description =
      include.descriptions === true ? `Description ${key}` : undefined;

    const content = icon ?? `${letter.repeat(3)}${suffix}`;

    yield {
      key,
      item: {
        key: (i + 1) * 100,
        content,
        textValue: content,
        description,
        icon,
      },
    };
  }
}

/**
 * Pseudo random number generator with seed so we get reproducible output.
 * This is necessary in order for e2e tests to work.
 */
export function* pseudoRandomWithSeed(
  seed = 1
): Generator<number, void, never> {
  while (true) {
    // eslint-disable-next-line no-param-reassign
    seed = (seed * 16807) % 2147483647;
    yield seed / 2147483647;
  }
}

/**
 * Returns a callback that will generate pseudo random numbers based on the
 * given seed.
 * @param seed
 */
export function useSeededRandomNumberCallback(seed = 1): () => number {
  const [randomGenerator] = useState(() => pseudoRandomWithSeed(seed));

  return useCallback(() => {
    const result = randomGenerator.next();

    if (result.done === true) {
      throw new Error('Random number generator unexpectedly finished');
    }

    return result.value;
  }, [randomGenerator]);
}

/**
 * Return id and className props for a sample section. Class
 * names generated by this util are used by e2e tests to take snapshots of
 * styleguide sections.
 * @param name Name of the section
 * @param classNames Optional list of class names to include
 */
export function sampleSectionIdAndClasses(
  name: string,
  classNames: string[] = []
): { id: string; className: string } {
  const id = `${SAMPLE_SECTION_CLASS}-${name
    .toLocaleLowerCase()
    .replaceAll(' ', '-')}`;

  const className = cl(SAMPLE_SECTION_CLASS, ...classNames);

  return {
    id,
    className,
  };
}

/**
 * Return id and UNSAFE_className props for a sample section. Class
 * names generated by this util are used by e2e tests to take snapshots of
 * styleguide sections.
 * @param name Name of the section
 * @param classNames Optional list of class names to include
 */
export function sampleSectionIdAndClassesSpectrum(
  name: string,
  classNames: string[] = []
): { id: string; UNSAFE_className: string } {
  const { id, className } = sampleSectionIdAndClasses(name, classNames);

  return {
    id,
    UNSAFE_className: className,
  };
}
