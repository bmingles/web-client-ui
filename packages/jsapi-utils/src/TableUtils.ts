import {
  Type as FilterType,
  Operator as FilterOperator,
  type TypeValue as FilterTypeValue,
  type OperatorValue as FilterOperatorValue,
} from '@deephaven/filters';
import Log from '@deephaven/log';
import type { dh as DhType } from '@deephaven/jsapi-types';
import {
  assertNotNull,
  bindAllMethods,
  type CancelablePromise,
  PromiseUtils,
  removeNullAndUndefined,
  TextUtils,
  TimeoutError,
} from '@deephaven/utils';
import DateUtils from './DateUtils';
import { type ColumnName } from './Formatter';
import { createValueFilter, type FilterConditionFactory } from './FilterUtils';
import { getSize } from './ViewportDataUtils';

const log = Log.module('TableUtils');

type Values<T> = T[keyof T];
export type DataType = Values<typeof TableUtils.dataType>;
export type SortDirection = Values<typeof TableUtils.sortDirection>;
export type ReverseType = Values<typeof TableUtils.REVERSE_TYPE>;
export type AdvancedFilterItemType = {
  selectedType: FilterTypeValue;
  value: string;
};

export interface FilterItem {
  selectedType: FilterTypeValue;
  value: string;
}

export type AdvancedFilterOptions = {
  filterItems: FilterItem[];
  filterOperators: FilterOperatorValue[];
  invertSelection: boolean;
  selectedValues: unknown[];
};

export type RowDataMapValue = {
  type: string;
  text: string;
  value: unknown;
  isExpandable: boolean;
  isGrouped: boolean;
  visibleIndex: number;
};

export type RowDataMap = Record<ColumnName, RowDataMapValue>;

export function isSortDirection(value: string | null): value is SortDirection {
  return (
    value === TableUtils.sortDirection.ascending ||
    value === TableUtils.sortDirection.descending ||
    value === TableUtils.sortDirection.reverse ||
    value === TableUtils.sortDirection.none
  );
}

/** Utility class to provide some functions for working with tables */
export class TableUtils {
  static dataType = {
    BOOLEAN: 'boolean',
    CHAR: 'char',
    DATETIME: 'datetime',
    DECIMAL: 'decimal',
    INT: 'int',
    STRING: 'string',
    UNKNOWN: 'unknown',
  } as const;

  static sortDirection = {
    ascending: 'ASC',
    descending: 'DESC',
    reverse: 'REVERSE',
    none: null,
  } as const;

  static APPLY_TABLE_CHANGE_TIMEOUT_MS = 30000;

  static REVERSE_TYPE = Object.freeze({
    NONE: 'none',
    PRE_SORT: 'pre-sort',
    POST_SORT: 'post-sort',
  } as const);

  // Regex looking for a negative or positive integer or decimal number
  static NUMBER_REGEX = /^-?\d+(\.\d+)?$/;

  /**
   * Copy a given table and apply filters.
   * @param maybeTable Table to copy and apply filters to
   * @param filterFactories Filter condition factories to apply
   * @returns A derived, filtered table
   */
  static async copyTableAndApplyFilters<
    T extends DhType.Table | null | undefined,
    R extends T extends DhType.Table ? T : null,
  >(maybeTable: T, ...filterFactories: FilterConditionFactory[]): Promise<R> {
    if (maybeTable == null) {
      return null as R;
    }

    const derivedTable = await maybeTable.copy();

    derivedTable.applyFilter(
      removeNullAndUndefined(...filterFactories.map(f => f(derivedTable)))
    );

    return derivedTable as R;
  }

  /**
   * Executes a callback on a given table and returns a Promise that will resolve
   * the next time a particular event type fires on the table.
   * @param exec Callback function to execute.
   * @param table Table that gets passed to the `exec` function and that is
   * subscribed to for a given `eventType`.
   * @param eventType The event type to listen for.
   * @param timeout If the event doesn't fire within the timeout, the returned
   * Promise will be rejected.
   * @returns a Promise to the original table that resolves on next `eventType`
   * event
   */
  static executeAndWaitForEvent = async <
    T extends DhType.Table | DhType.TreeTable,
  >(
    exec: (maybeTable: T | null | undefined) => void,
    table: T | null | undefined,
    eventType: string,
    timeout = TableUtils.APPLY_TABLE_CHANGE_TIMEOUT_MS
  ): Promise<T | null> => {
    if (table == null) {
      return null;
    }

    const eventPromise = TableUtils.makeCancelableTableEventPromise(
      table,
      eventType,
      timeout
    );

    exec(table);

    await eventPromise;

    return table;
  };

  static getSortIndex(
    sort: readonly DhType.Sort[],
    columnName: ColumnName
  ): number | null {
    for (let i = 0; i < sort.length; i += 1) {
      const s = sort[i];
      if (s.column?.name === columnName) {
        return i;
      }
    }

    return null;
  }

  /**
   * @param tableSort The sorts from the table to get the sort from
   * @param columnName The name of the column to get the sort for
   * @returns The sort for the column, or null if it's not sorted
   */
  static getSortForColumn(
    tableSort: readonly DhType.Sort[],
    columnName: ColumnName
  ): DhType.Sort | null {
    const sortIndex = TableUtils.getSortIndex(tableSort, columnName);
    if (sortIndex != null) {
      return tableSort[sortIndex];
    }
    return null;
  }

  static getFilterText(filter?: DhType.FilterCondition | null): string | null {
    if (filter) {
      return filter.toString();
    }
    return null;
  }

  /** Return the valid filter types for the column */
  static getFilterTypes(columnType: string): FilterTypeValue[] {
    if (TableUtils.isBooleanType(columnType)) {
      return [FilterType.isTrue, FilterType.isFalse, FilterType.isNull];
    }
    if (
      TableUtils.isCharType(columnType) ||
      TableUtils.isNumberType(columnType) ||
      TableUtils.isDateType(columnType)
    ) {
      return [
        FilterType.eq,
        FilterType.notEq,
        FilterType.greaterThan,
        FilterType.greaterThanOrEqualTo,
        FilterType.lessThan,
        FilterType.lessThanOrEqualTo,
      ];
    }
    if (TableUtils.isTextType(columnType)) {
      return [
        FilterType.eq,
        FilterType.eqIgnoreCase,
        FilterType.notEq,
        FilterType.notEqIgnoreCase,
        FilterType.contains,
        FilterType.notContains,
        FilterType.startsWith,
        FilterType.endsWith,
      ];
    }
    return [];
  }

  static getNextSort(
    columns: readonly DhType.Column[],
    sorts: readonly DhType.Sort[],
    columnIndex: number
  ): DhType.Sort | null {
    if (columnIndex < 0 || columnIndex >= columns.length) {
      return null;
    }

    const sort = TableUtils.getSortForColumn(sorts, columns[columnIndex].name);
    if (sort === null) {
      return columns[columnIndex].sort().asc();
    }
    if (sort.direction === TableUtils.sortDirection.ascending) {
      return sort.desc();
    }
    return null;
  }

  static makeColumnSort(
    columns: readonly DhType.Column[],
    columnIndex: number,
    direction: SortDirection,
    isAbs: boolean
  ): DhType.Sort | null {
    if (columnIndex < 0 || columnIndex >= columns.length) {
      return null;
    }

    if (direction === TableUtils.sortDirection.none) {
      return null;
    }

    let sort = columns[columnIndex].sort();

    switch (direction) {
      case TableUtils.sortDirection.ascending:
        sort = sort.asc();
        break;
      case TableUtils.sortDirection.descending:
        sort = sort.desc();
        break;
      default:
        break;
    }
    if (isAbs) {
      sort = sort.abs();
    }
    return sort;
  }

  /**
   * Toggles the sort for the specified column
   * @param sorts The current sorts from IrisGrid.state
   * @param columns The columns to apply the sort to
   * @param columnIndex The column index to apply the sort to
   * @param addToExisting Add this sort to the existing sort
   */
  static toggleSortForColumn(
    sorts: readonly DhType.Sort[],
    columns: readonly DhType.Column[],
    columnIndex: number,
    addToExisting = false
  ): DhType.Sort[] {
    if (columnIndex < 0 || columnIndex >= columns.length) {
      return [];
    }

    const newSort = TableUtils.getNextSort(columns, sorts, columnIndex);

    return TableUtils.setSortForColumn(
      sorts,
      columns[columnIndex].name,
      newSort,
      addToExisting
    );
  }

  static sortColumn(
    sorts: readonly DhType.Sort[],
    columns: readonly DhType.Column[],
    modelColumn: number,
    direction: SortDirection,
    isAbs: boolean,
    addToExisting: boolean
  ): DhType.Sort[] {
    if (modelColumn < 0 || modelColumn >= columns.length) {
      return [];
    }

    const newSort = TableUtils.makeColumnSort(
      columns,
      modelColumn,
      direction,
      isAbs
    );

    return TableUtils.setSortForColumn(
      sorts,
      columns[modelColumn].name,
      newSort,
      addToExisting
    );
  }

  /**
   * Sets the sort for the given column *and* removes any reverses
   * @param tableSort The current sorts from IrisGrid.state
   * @param columnName The column name to apply the sort to
   * @param sort The sort object to add
   * @param addToExisting Add this sort to the existing sort
   * @returns Returns the modified array of sorts - removing reverses
   */
  static setSortForColumn(
    tableSort: readonly DhType.Sort[],
    columnName: ColumnName,
    sort: DhType.Sort | null,
    addToExisting = false
  ): DhType.Sort[] {
    const sortIndex = TableUtils.getSortIndex(tableSort, columnName);
    let sorts: DhType.Sort[] = [];
    if (addToExisting) {
      sorts = sorts.concat(
        tableSort.filter(
          ({ direction }) => direction !== TableUtils.sortDirection.reverse
        )
      );
      if (sortIndex !== null) {
        sorts.splice(sortIndex, 1);
      }
    }

    if (sort !== null) {
      sorts.push(sort);
    }

    return sorts;
  }

  static getNormalizedType(columnType?: string | null): DataType {
    switch (columnType) {
      case 'boolean':
      case 'java.lang.Boolean':
      case TableUtils.dataType.BOOLEAN:
        return TableUtils.dataType.BOOLEAN;
      case 'char':
      case 'java.lang.Character':
      case TableUtils.dataType.CHAR:
        return TableUtils.dataType.CHAR;
      case 'java.lang.String':
      case TableUtils.dataType.STRING:
        return TableUtils.dataType.STRING;
      case 'io.deephaven.db.tables.utils.DBDateTime':
      case 'io.deephaven.time.DateTime':
      case 'com.illumon.iris.db.tables.utils.DBDateTime':
      case 'java.time.Instant':
      case 'java.time.ZonedDateTime':
      case TableUtils.dataType.DATETIME:
        return TableUtils.dataType.DATETIME;
      case 'double':
      case 'java.lang.Double':
      case 'float':
      case 'java.lang.Float':
      case 'java.math.BigDecimal':
      case TableUtils.dataType.DECIMAL:
        return TableUtils.dataType.DECIMAL;
      case 'int':
      case 'java.lang.Integer':
      case 'long':
      case 'java.lang.Long':
      case 'short':
      case 'java.lang.Short':
      case 'byte':
      case 'java.lang.Byte':
      case 'java.math.BigInteger':
      case TableUtils.dataType.INT:
        return TableUtils.dataType.INT;
      default:
        return TableUtils.dataType.UNKNOWN;
    }
  }

  static isLongType(columnType: string): boolean {
    switch (columnType) {
      case 'long':
      case 'java.lang.Long':
        return true;
      default:
        return false;
    }
  }

  static isDateType(columnType: string): boolean {
    switch (columnType) {
      case 'io.deephaven.db.tables.utils.DBDateTime':
      case 'io.deephaven.time.DateTime':
      case 'java.time.Instant':
      case 'java.time.ZonedDateTime':
      case 'com.illumon.iris.db.tables.utils.DBDateTime':
        return true;
      default:
        return false;
    }
  }

  static isNumberType(columnType: string): boolean {
    return (
      TableUtils.isIntegerType(columnType) ||
      TableUtils.isDecimalType(columnType)
    );
  }

  static isIntegerType(columnType: string): boolean {
    switch (columnType) {
      case 'int':
      case 'java.lang.Integer':
      case 'java.math.BigInteger':
      case 'long':
      case 'java.lang.Long':
      case 'short':
      case 'java.lang.Short':
      case 'byte':
      case 'java.lang.Byte':
        return true;
      default:
        return false;
    }
  }

  static isDecimalType(columnType: string): boolean {
    switch (columnType) {
      case 'double':
      case 'java.lang.Double':
      case 'java.math.BigDecimal':
      case 'float':
      case 'java.lang.Float':
        return true;
      default:
        return false;
    }
  }

  static isBigDecimalType(columnType: string): boolean {
    switch (columnType) {
      case 'java.math.BigDecimal':
        return true;
      default:
        return false;
    }
  }

  static isBigIntegerType(columnType: string): boolean {
    switch (columnType) {
      case 'java.math.BigInteger':
        return true;
      default:
        return false;
    }
  }

  static isBooleanType(columnType: string): boolean {
    switch (columnType) {
      case 'boolean':
      case 'java.lang.Boolean':
        return true;
      default:
        return false;
    }
  }

  static isCharType(columnType: string): boolean {
    switch (columnType) {
      case 'char':
      case 'java.lang.Character':
        return true;
      default:
        return false;
    }
  }

  static isStringType(columnType: string): boolean {
    switch (columnType) {
      case 'java.lang.String':
        return true;
      default:
        return false;
    }
  }

  static isTextType(columnType: string): boolean {
    return this.isStringType(columnType) || this.isCharType(columnType);
  }

  /**
   * Get base column type
   * @param columnType Column type
   * @returns Element type for array columns, original type for non-array columns
   */
  static getBaseType(columnType: string): string {
    return columnType.split('[]')[0];
  }

  /**
   * Check if the column types are compatible
   * @param type1 Column type to check
   * @param type2 Column type to check
   * @returns True, if types are compatible
   */
  static isCompatibleType(
    type1?: string | null,
    type2?: string | null
  ): boolean {
    return (
      TableUtils.getNormalizedType(type1) ===
      TableUtils.getNormalizedType(type2)
    );
  }

  /**
   * Adds quotes to a value if they're not already added
   * @param value Value to add quotes around
   */
  static quoteValue(value: string): string {
    if (
      value.length >= 2 &&
      ((value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') ||
        (value.charAt(0) === "'" && value.charAt(value.length - 1) === "'"))
    ) {
      return value;
    }
    return `"${value}"`;
  }

  static isRangeOperation(operation: string): boolean {
    switch (operation) {
      case '<':
      case '<=':
      case '=<':
      case '>':
      case '>=':
      case '=>':
        return true;
      default:
        return false;
    }
  }

  /**
   * @param filter The column filter to apply the range operation to
   * @param operation The range operation to run
   * @param value The value to use for the operation
   * @returns The condition with the specified operation
   */
  static makeRangeFilterWithOperation(
    filter: DhType.FilterValue,
    operation: string,
    value: DhType.FilterValue
  ): DhType.FilterCondition | null {
    switch (operation) {
      case '=':
        return filter.eq(value);
      case '<':
        return filter.lessThan(value);
      case '<=':
      case '=<':
        return filter.lessThanOrEqualTo(value);
      case '>':
        return filter.greaterThan(value);
      case '>=':
      case '=>':
        return filter.greaterThanOrEqualTo(value);
      case '!=':
      case '!':
        return filter.notEq(value);
      default:
        return null;
    }
  }

  /**
   * Wraps a table promise in a cancelable promise that will close the table if the promise is cancelled.
   * Use in a component that loads a table, and call cancel when unmounting.
   * @param table The table promise to wrap
   */
  static makeCancelableTablePromise(
    table: Promise<DhType.Table> | DhType.Table
  ): CancelablePromise<DhType.Table> {
    return PromiseUtils.makeCancelable(table, resolved => {
      resolved.close();
    });
  }

  /**
   * Make a cancelable promise for a one-shot table event with a timeout.
   * @param table Table to listen for events on
   * @param eventName Event to listen for
   * @param timeout Event timeout in milliseconds, defaults to 0
   * @param matcher Optional function to determine if the promise can be resolved or stays pending
   * @returns Resolves with the event data
   */
  static makeCancelableTableEventPromise<TEventDetails = unknown>(
    table: DhType.Table | DhType.TreeTable,
    eventName: string,
    timeout = 0,
    matcher: ((event: DhType.Event<TEventDetails>) => boolean) | null = null
  ): CancelablePromise<DhType.Event<TEventDetails>> {
    let eventCleanup: () => void;
    let timeoutId: ReturnType<typeof setTimeout>;
    let isPending = true;
    const wrappedPromise = new Promise((resolve, reject) => {
      timeoutId = setTimeout(() => {
        eventCleanup();
        isPending = false;
        reject(new TimeoutError(`Event "${eventName}" timed out.`));
      }, timeout);
      eventCleanup = table.addEventListener<TEventDetails>(eventName, event => {
        if (matcher != null && !matcher(event)) {
          log.debug2('Event triggered, but matcher returned false.');
          return;
        }
        log.debug2('Event triggered, resolving.');
        eventCleanup();
        clearTimeout(timeoutId);
        isPending = false;
        resolve(event);
      });
    }) as CancelablePromise<DhType.Event<TEventDetails>>;
    wrappedPromise.cancel = () => {
      if (isPending) {
        log.debug2('Pending promise cleanup.');
        eventCleanup();
        clearTimeout(timeoutId);
        isPending = false;
        return;
      }
      log.debug2('Ignoring non-pending promise cancel.');
    };
    return wrappedPromise;
  }

  static removeCommas(value: string): string {
    return value.replace(/[\s|,]/g, '');
  }

  static makeBooleanValue(text: string, allowEmpty = false): boolean | null {
    if (text === '' && allowEmpty) {
      return null;
    }

    switch (text?.toLowerCase()) {
      case 'null':
        return null;
      case '0':
      case 'f':
      case 'fa':
      case 'fal':
      case 'fals':
      case 'false':
      case 'n':
      case 'no':
        return false;
      case '1':
      case 't':
      case 'tr':
      case 'tru':
      case 'true':
      case 'y':
      case 'ye':
      case 'yes':
        return true;
      default:
        throw new Error(`Invalid boolean '${text}'`);
    }
  }

  static makeNumberValue(text: string): number | null {
    if (text === 'null' || text === '') {
      return null;
    }

    const cleanText = text.toLowerCase().trim();
    if (cleanText === '∞' || cleanText === 'infinity' || cleanText === 'inf') {
      return Number.POSITIVE_INFINITY;
    }
    if (
      cleanText === '-∞' ||
      cleanText === '-infinity' ||
      cleanText === '-inf'
    ) {
      return Number.NEGATIVE_INFINITY;
    }

    const numberText = TableUtils.removeCommas(cleanText);
    if (TableUtils.NUMBER_REGEX.test(numberText)) {
      return parseFloat(numberText);
    }

    throw new Error(`Invalid number '${text}'`);
  }

  static getFilterOperatorString(operation: FilterTypeValue): string {
    switch (operation) {
      case FilterType.eq:
        return '=';
      case FilterType.notEq:
        return '!=';
      case FilterType.greaterThan:
        return '>';
      case FilterType.greaterThanOrEqualTo:
        return '>=';
      case FilterType.lessThan:
        return '<';
      case FilterType.lessThanOrEqualTo:
        return '<=';
      case FilterType.contains:
        return '~';
      case FilterType.notContains:
        return '!~';
      default:
        throw new Error(`Unexpected filter type ${operation}`);
    }
  }

  static isPartitionedTable(table: unknown): table is DhType.PartitionedTable {
    return (
      table != null &&
      (table as DhType.PartitionedTable).getMergedTable !== undefined &&
      (table as DhType.PartitionedTable).getKeyTable !== undefined &&
      (table as DhType.PartitionedTable).getKeys !== undefined
    );
  }

  static isTreeTable(table: unknown): table is DhType.TreeTable {
    return (
      table != null &&
      (table as DhType.TreeTable).expand !== undefined &&
      (table as DhType.TreeTable).collapse !== undefined
    );
  }

  /**
   * Copies the provided array, sorts by column name case insensitive, and returns the sorted array.
   * @param columns The columns to sort
   * @param isAscending Whether to sort ascending
   */
  static sortColumns(
    columns: readonly DhType.Column[],
    isAscending = true
  ): DhType.Column[] {
    return [...columns].sort((a, b) => {
      const aName = a.name.toUpperCase();
      const bName = b.name.toUpperCase();
      return TextUtils.sort(aName, bName, isAscending);
    });
  }

  dh: typeof DhType;

  constructor(dh: typeof DhType) {
    this.dh = dh;
    bindAllMethods(this);
  }

  /**
   * Create a table containing a distinct list of values for given column name and
   * applies the given sort direction.
   * @param table Source table to derive table from
   * @param columnName Column to dermine distinct values
   * @param sortDirection Direction to sort
   * @param filterConditionFactories Optional filters to apply. Note that these
   * will be applied before the `selectCall` in case we need to base the filtering
   * on columns other than the distinct value column
   */
  async createDistinctSortedColumnTable(
    table: DhType.Table | null | undefined,
    columnName: string,
    sortDirection: 'asc' | 'desc',
    ...filterConditionFactories: FilterConditionFactory[]
  ): Promise<DhType.Table | null> {
    if (table == null) {
      return null;
    }

    let sourceTable = table;

    // Applying filters before `selectDistinct` so that we still have access to
    // all columns. Also prevents a filter applied to the final table from
    // clearing this filter.
    if (filterConditionFactories.length > 0) {
      sourceTable = await table.copy();

      await sourceTable.applyFilter(
        removeNullAndUndefined(
          ...filterConditionFactories.map(f => f(sourceTable))
        )
      );
    }

    const column = sourceTable.findColumn(columnName);
    const distinctTable = await sourceTable.selectDistinct([column]);

    // If we copied the table, dispose the copy. Original is managed outside
    // of this function
    if (sourceTable !== table) {
      sourceTable.close();
    }

    const distinctAscColSort = distinctTable
      .findColumn(columnName)
      .sort()
      [sortDirection]();

    return this.applySort(distinctTable, [distinctAscColSort]);
  }

  /**
   * Check if any columns contain a given value.
   * @param table Table to search for values
   * @param columnNames Column names to search
   * @param value Value to search for
   * @param isCaseSensitive Whether the value check is case sensitive
   */
  async doesColumnValueExist(
    table: DhType.Table | null | undefined,
    columnNames: string | string[],
    value: string,
    isCaseSensitive: boolean
  ): Promise<boolean | null> {
    if (table == null) {
      return null;
    }

    const filterConditionFactory = createValueFilter(
      this,
      columnNames,
      value,
      isCaseSensitive ? 'eq' : 'eqIgnoreCase'
    );

    const tableCopy = await table.copy();

    await this.applyFilter(
      tableCopy,
      removeNullAndUndefined(filterConditionFactory(tableCopy))
    );

    const size = getSize(tableCopy);

    tableCopy.close();

    return size > 0;
  }

  /**
   * Get the `dh.ValueType` corresponding to the given `dh.Column.type` value.
   * @param columnType The column type to get the value type for
   * @returns The `dh.ValueType` corresponding to the column type
   */
  getValueType(columnType?: string): string {
    if (columnType == null) {
      return this.dh.ValueType.STRING;
    }

    const columnDataType = TableUtils.getNormalizedType(columnType);

    switch (columnDataType) {
      case TableUtils.dataType.BOOLEAN:
        return this.dh.ValueType.BOOLEAN;

      case TableUtils.dataType.CHAR:
      case TableUtils.dataType.STRING:
        return this.dh.ValueType.STRING;

      case TableUtils.dataType.DATETIME:
        return this.dh.ValueType.DATETIME;

      case TableUtils.dataType.DECIMAL:
      case TableUtils.dataType.INT:
        if (
          TableUtils.isBigDecimalType(columnType) ||
          TableUtils.isBigIntegerType(columnType)
        ) {
          return this.dh.ValueType.STRING;
        }

        return this.dh.ValueType.NUMBER;

      default:
        return this.dh.ValueType.STRING;
    }
  }

  /**
   * Create filter with the provided column and text. Handles multiple filters joined with && or ||
   * @param column The column to set the filter on
   * @param text The text string to create the filter from
   * @param timeZone The time zone to make this value in if it is a date type. E.g. America/New_York
   * @returns Returns the created filter, null if text could not be parsed
   */
  makeQuickFilter(
    column: DhType.Column,
    text: string,
    timeZone?: string
  ): DhType.FilterCondition | null {
    const orComponents = text.split('||');
    let orFilter = null;
    for (let i = 0; i < orComponents.length; i += 1) {
      const orComponent = orComponents[i];
      const andComponents = orComponent.split('&&');
      let andFilter = null;
      for (let j = 0; j < andComponents.length; j += 1) {
        const andComponent = andComponents[j].trim();
        if (andComponent.length > 0) {
          const filter = this.makeQuickFilterFromComponent(
            column,
            andComponent,
            timeZone
          );
          if (filter) {
            if (andFilter) {
              andFilter = andFilter.and(filter);
            } else {
              andFilter = filter;
            }
          } else {
            throw new Error(`Unable to parse quick filter from text ${text}`);
          }
        }
      }

      if (orFilter && andFilter) {
        orFilter = orFilter.or(andFilter);
      } else {
        orFilter = andFilter;
      }
    }

    return orFilter;
  }

  /**
   * Create filter with the provided column and text of one component (no multiple conditions)
   * @param column The column to set the filter on
   * @param text The text string to create the filter from
   * @param timeZone The time zone to make this filter in if it is a date type. E.g. America/New_York
   * @returns Returns the created filter, null if text could not be parsed
   */
  makeQuickFilterFromComponent(
    column: DhType.Column,
    text: string,
    timeZone?: string
  ): DhType.FilterCondition | null {
    const { type } = column;
    if (TableUtils.isNumberType(type)) {
      return this.makeQuickNumberFilter(column, text);
    }
    if (TableUtils.isBooleanType(type)) {
      return this.makeQuickBooleanFilter(column, text);
    }
    if (timeZone != null && TableUtils.isDateType(type)) {
      return this.makeQuickDateFilter(column, text, timeZone);
    }
    if (TableUtils.isCharType(type)) {
      return this.makeQuickCharFilter(column, text);
    }
    return this.makeQuickTextFilter(column, text);
  }

  makeQuickNumberFilter(
    column: DhType.Column,
    text: string
  ): DhType.FilterCondition | null {
    const columnFilter = column.filter();
    const { dh } = this;
    let filter = null;

    const regex =
      /\s*(>=|<=|=>|=<|>|<|!=|=|!)?(\s*-\s*)?(\s*\d*(?:,\d{3})*(?:\.\d*)?\s*)?(null|nan|infinity|inf|\u221E)?(.*)/i;
    const result = regex.exec(text);

    let operation = null;
    let negativeSign = null;
    let value = null;
    let abnormalValue = null; // includes nan, null and infinity(positive & negative)
    let overflow = null;

    if (result !== null && result.length > 3) {
      [, operation, negativeSign, value, abnormalValue, overflow] = result;
    }

    if (overflow != null && overflow.trim().length > 0) {
      // Some bad characters after the number, bail out!
      return null;
    }

    if (operation == null) {
      operation = '=';
    }

    if (abnormalValue != null) {
      if (!(operation === '=' || operation === '!' || operation === '!=')) {
        // only equal and not equal operations are supported for abnormal value filter
        return null;
      }
      abnormalValue = abnormalValue.trim().toLowerCase();
      switch (abnormalValue) {
        case 'null':
          filter = columnFilter.isNull();
          break;
        case 'nan':
          filter = dh.FilterCondition.invoke('isNaN', columnFilter);
          break;
        case 'infinity':
        case 'inf':
        case '\u221E':
          if (negativeSign != null) {
            filter = dh.FilterCondition.invoke('isInf', columnFilter).and(
              columnFilter.lessThan(dh.FilterValue.ofNumber(0))
            );
          } else {
            filter = dh.FilterCondition.invoke('isInf', columnFilter).and(
              columnFilter.greaterThan(dh.FilterValue.ofNumber(0))
            );
          }
          break;
        default:
          break;
      }
      if (filter !== null && (operation === '!' || operation === '!=')) {
        filter = filter.not();
      }
      return filter;
    }

    if (value == null) {
      return null;
    }

    value = TableUtils.removeCommas(value);
    if (TableUtils.isLongType(column.type)) {
      try {
        value = dh.FilterValue.ofNumber(
          dh.LongWrapper.ofString(`${negativeSign != null ? '-' : ''}${value}`)
        );
      } catch (error) {
        log.warn('Unable to create long filter', error);
        return null;
      }
    } else {
      value = parseFloat(value);
      if (value == null || Number.isNaN(value)) {
        return null;
      }

      value = dh.FilterValue.ofNumber(negativeSign != null ? 0 - value : value);
    }

    filter = column.filter();

    return TableUtils.makeRangeFilterWithOperation(filter, operation, value);
  }

  /**
   * Given a text string from a table, escape quick filter operators in string with \
   * ex. =test returns \=test, null returns \null
   * @param string quickfilter string to escape
   * @returns escaped string
   */
  static escapeQuickTextFilter(quickFilterText: string | null): string | null {
    if (quickFilterText == null) return null;
    const regex = /^(!~|!=|~|=|!)?(.*)/;
    // starts with zero or more \ followed by and ending with null
    const nullRegex = /^\\*null$/;
    const result = regex.exec(quickFilterText);
    let operation: string | null = null;
    let value: string | null = null;
    if (result !== null && result.length > 2) {
      [, operation, value] = result;
    }

    if (operation != null) {
      return `\\${operation}${value ?? ''}`;
    }

    if (value != null && nullRegex.test(value.toLowerCase())) {
      // adds an extra escape character to matching value
      return `\\${value}`;
    }
    if (value != null && value.startsWith('*')) {
      return `\\${value}`;
    }
    if (value != null && value.endsWith('*') && !value.endsWith('\\*')) {
      value = value.substring(0, value.length - 1);
      return `${value}\\*`;
    }

    return `${operation ?? ''}${value ?? ``}`;
  }

  /**
   * Given an escaped quick filter, unescape the operators for giving it to the js api
   * ex. \=test returns =test, \null returns null
   * @param string quickfilter string to escape
   * @returns escaped string
   */
  static unescapeQuickTextFilter(quickFilterText: string): string {
    const regex = /^(\\!~|\\!=|\\~|\\=|\\!)?(.*)/;
    // starts with zero or more \ followed by and ending with null
    const nullRegex = /^\\*null$/;
    const result = regex.exec(quickFilterText);
    let operation: string | null = null;
    let value: string | null = null;
    if (result !== null && result.length > 2) {
      [, operation, value] = result;
    }

    if (operation != null) {
      operation = operation.replace('\\', '');
    }

    if (value != null && nullRegex.test(value.toLowerCase())) {
      // removes the first occurance of the backslash
      value = value.replace('\\', '');
    }
    if (operation == null && value != null && value.startsWith('\\*')) {
      value = value.substring(1);
    }
    if (operation == null && value != null && value.endsWith('\\*')) {
      value = value.substring(0, value.length - 2);
      return `${value}*`;
    }

    return `${operation ?? ''}${value ?? ``}`;
  }

  makeQuickTextFilter(
    column: DhType.Column,
    text: string
  ): DhType.FilterCondition | null {
    const { dh } = this;
    const cleanText = `${text}`.trim();
    const regex = /^(!~|!=|~|=|!)?(.*)/;
    const result = regex.exec(cleanText);

    let operation = null;
    let value = null;
    if (result !== null && result.length > 2) {
      [, operation, value] = result;
      if (value != null) {
        value = value.trim();
      }
    }

    if (value == null) {
      return null;
    }

    // allow empty strings, but only for explicit equal and not equal
    if (value.length === 0 && !(operation === '=' || operation === '!=')) {
      return null;
    }

    // no operation is treated as an implicit equals
    if (operation == null) {
      operation = '=';
    }

    const filter = column.filter();
    if (value.toLowerCase() === 'null') {
      // Null is a special case!
      switch (operation) {
        case '=':
          return filter.isNull();
        case '!=':
        case '!':
          return filter.isNull().not();
        default:
        // For all other operations, treat null as a string value
      }
    }

    let prefix = null;
    let suffix = null;
    if (value.startsWith('*')) {
      prefix = '*';
      value = value.substring(1);
    } else if (value.endsWith('*') && !value.endsWith('\\*')) {
      suffix = '*';
      value = value.substring(0, value.length - 1);
    }

    // unescape any escaped operators to allow search for literal operators
    value = TableUtils.unescapeQuickTextFilter(value);

    switch (operation) {
      case '~': {
        return filter
          .isNull()
          .not()
          .and(
            filter.invoke(
              'matches',
              dh.FilterValue.ofString(`(?s)(?i).*\\Q${value}\\E.*`)
            )
          );
      }
      case '!~':
        return filter
          .isNull()
          .or(
            filter
              .invoke(
                'matches',
                dh.FilterValue.ofString(`(?s)(?i).*\\Q${value}\\E.*`)
              )
              .not()
          );
      case '!=':
        if (prefix === '*') {
          // Does not end with
          return filter
            .isNull()
            .or(
              filter
                .invoke(
                  'matches',
                  dh.FilterValue.ofString(`(?s)(?i).*\\Q${value}\\E$`)
                )
                .not()
            );
        }
        if (suffix === '*') {
          // Does not start with
          return filter
            .isNull()
            .or(
              filter
                .invoke(
                  'matches',
                  dh.FilterValue.ofString(`(?s)(?i)^\\Q${value}\\E.*`)
                )
                .not()
            );
        }
        return filter.notEqIgnoreCase(
          dh.FilterValue.ofString(value.toLowerCase())
        );
      case '=':
        if (prefix === '*') {
          // Ends with
          return filter
            .isNull()
            .not()
            .and(
              filter.invoke(
                'matches',
                dh.FilterValue.ofString(`(?s)(?i).*\\Q${value}\\E$`)
              )
            );
        }
        if (suffix === '*') {
          // Starts with
          return filter
            .isNull()
            .not()
            .and(
              filter.invoke(
                'matches',
                dh.FilterValue.ofString(`(?s)(?i)^\\Q${value}\\E.*`)
              )
            );
        }
        return filter.eqIgnoreCase(
          dh.FilterValue.ofString(value.toLowerCase())
        );

      default:
        break;
    }

    return null;
  }

  // eslint-disable-next-line class-methods-use-this
  makeQuickBooleanFilter(
    column: DhType.Column,
    text: string | number
  ): DhType.FilterCondition | null {
    const regex = /^(!=|=|!)?(.*)/;
    const result = regex.exec(`${text}`.trim());
    if (result === null) {
      return null;
    }
    const [, operation, value] = result;
    const notEqual = operation === '!' || operation === '!=';
    const cleanValue = value.trim().toLowerCase();

    let filter: DhType.FilterCondition | DhType.FilterValue = column.filter();

    try {
      const boolValue = TableUtils.makeBooleanValue(cleanValue);
      if (boolValue != null && boolValue) {
        filter = filter.isTrue();
      } else if (boolValue === null) {
        filter = filter.isNull();
      } else {
        filter = filter.isFalse();
      }

      return notEqual ? filter.not() : filter;
    } catch (e) {
      return null;
    }
  }

  /**
   * Builds a date filter parsed from the text string which may or may not include an operator.
   * @param column The column to build the filter from, with or without a leading operator.
   * @param text The date string text to parse.
   * @param timeZone The time zone to make this filter in if it is a date type. E.g. America/New_York
   */
  makeQuickDateFilter(
    column: DhType.Column,
    text: string,
    timeZone: string
  ): DhType.FilterCondition {
    const cleanText = text.trim();
    const regex = /\s*(>=|<=|=>|=<|>|<|!=|!|=)?(.*)/;
    const result = regex.exec(cleanText);
    if (result == null || result.length <= 2) {
      throw new Error(`Unable to parse date filter: ${text}`);
    }

    let operation = null;
    let dateText = null;

    [, operation, dateText] = result;

    let filterOperation: FilterTypeValue = FilterType.eq;
    switch (operation) {
      case '<':
        filterOperation = FilterType.lessThan;
        break;
      case '<=':
      case '=<':
        filterOperation = FilterType.lessThanOrEqualTo;
        break;
      case '>':
        filterOperation = FilterType.greaterThan;
        break;
      case '>=':
      case '=>':
        filterOperation = FilterType.greaterThanOrEqualTo;
        break;
      case '!=':
      case '!':
        filterOperation = FilterType.notEq;
        break;
      case '=':
      case '==':
      default:
        filterOperation = FilterType.eq;
        break;
    }

    return this.makeQuickDateFilterWithOperation(
      column,
      dateText,
      filterOperation,
      timeZone
    );
  }

  /**
   * Builds a date filter parsed from the text string with the provided filter.
   * @param column The column to build the filter from.
   * @param text The date string text to parse, without an operator.
   * @param operation The filter operation to use.
   * @param timeZone The time zone to make this filter with. E.g. America/New_York
   */
  makeQuickDateFilterWithOperation(
    column: DhType.Column,
    text: string,
    operation: FilterTypeValue,
    timeZone: string
  ): DhType.FilterCondition {
    const { dh } = this;
    const [startDate, endDate] = DateUtils.parseDateRange(dh, text, timeZone);

    const startValue =
      startDate != null ? dh.FilterValue.ofNumber(startDate) : null;
    const endValue = endDate != null ? dh.FilterValue.ofNumber(endDate) : null;

    const filter = column.filter();
    if (startValue == null) {
      return operation === FilterType.notEq
        ? filter.isNull().not()
        : filter.isNull();
    }

    switch (operation) {
      case FilterType.eq: {
        if (endValue != null) {
          const startFilter = filter.greaterThanOrEqualTo(startValue);
          const endFilter = filter.lessThan(endValue);
          return startFilter.and(endFilter);
        }
        return filter.eq(startValue);
      }
      case FilterType.lessThan: {
        return filter.lessThan(startValue);
      }
      case FilterType.lessThanOrEqualTo: {
        if (endValue != null) {
          return filter.lessThan(endValue);
        }
        return filter.lessThanOrEqualTo(startValue);
      }
      case FilterType.greaterThan: {
        if (endValue != null) {
          return filter.greaterThanOrEqualTo(endValue);
        }
        return filter.greaterThan(startValue);
      }
      case FilterType.greaterThanOrEqualTo:
        return filter.greaterThanOrEqualTo(startValue);
      case FilterType.notEq: {
        if (endValue != null) {
          const startFilter = filter.lessThan(startValue);
          const endFilter = filter.greaterThanOrEqualTo(endValue);
          return startFilter.or(endFilter);
        }
        return filter.notEq(startValue);
      }

      default:
        throw new Error(`Invalid operator: ${operation}`);
    }
  }

  makeQuickCharFilter(
    column: DhType.Column,
    text: string
  ): DhType.FilterCondition | null {
    const { dh } = this;
    const cleanText = `${text}`.trim();
    const regex = /^(>=|<=|=>|=<|>|<|!=|=|!)?(null|"."|'.'|.)?(.*)/;
    const result = regex.exec(cleanText);

    let operation = null;
    let value = null;
    let overflow = null;
    if (result !== null && result.length > 3) {
      [, operation, value, overflow] = result;
    }
    if (overflow != null && overflow.trim().length > 0) {
      // Some bad characters after the number, bail out!
      return null;
    }

    if (value == null || value.length === 0) {
      return null;
    }

    if (operation == null) {
      operation = '=';
    }

    const filter = column.filter();
    if (value.toLowerCase() === 'null') {
      // Null is a special case!
      switch (operation) {
        case '=':
          return filter.isNull();
        case '!=':
        case '!':
          return filter.isNull().not();
        default:
          return null;
      }
    }

    // We need to put quotes around range operations or else the API fails
    const filterValue = dh.FilterValue.ofString(
      TableUtils.isRangeOperation(operation)
        ? TableUtils.quoteValue(value)
        : value
    );
    return TableUtils.makeRangeFilterWithOperation(
      filter,
      operation,
      filterValue
    );
  }

  makeAdvancedFilter(
    column: DhType.Column,
    options: AdvancedFilterOptions,
    timeZone: string
  ): DhType.FilterCondition | null {
    const { filterItems, filterOperators, invertSelection, selectedValues } =
      options;
    let filter = null;
    for (let i = 0; i < filterItems.length; i += 1) {
      const filterItem = filterItems[i];
      const { selectedType, value } = filterItem;
      if (
        selectedType != null &&
        selectedType.length > 0 &&
        value != null &&
        value.length > 0
      ) {
        try {
          const newFilter = this.makeAdvancedValueFilter(
            column,
            selectedType,
            value,
            timeZone
          );
          if (newFilter != null) {
            if (i === 0) {
              filter = newFilter;
            } else if (filter !== null && i - 1 < filterOperators.length) {
              const filterOperator = filterOperators[i - 1];
              if (filterOperator === FilterOperator.and) {
                filter = filter.and(newFilter);
              } else if (filterOperator === FilterOperator.or) {
                filter = filter.or(newFilter);
              } else {
                log.error(
                  'Unexpected filter operator',
                  filterOperator,
                  newFilter
                );
                filter = null;
                break;
              }
            }
          } else {
            log.debug2('Empty filter ignored for', selectedType, value);
          }
        } catch (err) {
          log.error('Unable to create filter', err);
          filter = null;
          break;
        }
      }
    }

    const selectValueFilter = this.makeSelectValueFilter(
      column,
      selectedValues,
      invertSelection
    );
    if (selectValueFilter != null) {
      if (filter != null) {
        filter = filter.and(selectValueFilter);
      } else {
        filter = selectValueFilter;
      }
    }

    return filter;
  }

  makeAdvancedValueFilter(
    column: DhType.Column,
    operation: FilterTypeValue,
    value: string,
    timeZone: string
  ): DhType.FilterCondition | null {
    const { dh } = this;
    if (TableUtils.isDateType(column.type)) {
      return this.makeQuickDateFilterWithOperation(
        column,
        value,
        operation,
        timeZone
      );
    }

    if (
      TableUtils.isNumberType(column.type) ||
      TableUtils.isCharType(column.type)
    ) {
      return this.makeQuickFilter(
        column,
        `${TableUtils.getFilterOperatorString(operation)}${value}`
      );
    }

    const filterValue = this.makeFilterValue(column.type, value);
    const filter = column.filter();
    switch (operation) {
      case FilterType.eq:
        return filter.eq(filterValue);
      case FilterType.eqIgnoreCase:
        return filter.eqIgnoreCase(filterValue);
      case FilterType.notEq:
        return filter.notEq(filterValue);
      case FilterType.notEqIgnoreCase:
        return filter.notEqIgnoreCase(filterValue);
      case FilterType.greaterThan:
        return filter.greaterThan(filterValue);
      case FilterType.greaterThanOrEqualTo:
        return filter.greaterThanOrEqualTo(filterValue);
      case FilterType.lessThan:
        return filter.lessThan(filterValue);
      case FilterType.lessThanOrEqualTo:
        return filter.lessThanOrEqualTo(filterValue);
      case FilterType.isTrue:
        return filter.isTrue();
      case FilterType.isFalse:
        return filter.isFalse();
      case FilterType.isNull:
        return filter.isNull();
      case FilterType.contains:
        return filter
          .isNull()
          .not()
          .and(
            filter.invoke(
              'matches',
              dh.FilterValue.ofString(`(?s)(?i).*\\Q${value}\\E.*`)
            )
          );
      case FilterType.notContains:
        return filter
          .isNull()
          .or(
            filter
              .invoke(
                'matches',
                dh.FilterValue.ofString(`(?s)(?i).*\\Q${value}\\E.*`)
              )
              .not()
          );
      case FilterType.startsWith:
        return filter
          .isNull()
          .not()
          .and(
            filter.invoke(
              'matches',
              dh.FilterValue.ofString(`(?s)(?i)^\\Q${value}\\E.*`)
            )
          );
      case FilterType.endsWith:
        return filter
          .isNull()
          .not()
          .and(
            filter.invoke(
              'matches',
              dh.FilterValue.ofString(`(?s)(?i).*\\Q${value}\\E$`)
            )
          );
      case FilterType.in:
      case FilterType.inIgnoreCase:
      case FilterType.notIn:
      case FilterType.notInIgnoreCase:
      case FilterType.invoke:
      default:
        throw new Error(`Unexpected filter operation: ${operation}`);
    }
  }

  /**
   * Create a filter condition that can search a column by a given `searchText`
   * value.
   * @param column The column to search
   * @param searchText The text to search for
   * @param timeZone The time zone to make this filter in if it is a date type. E.g. America/New_York
   * @returns The filter condition that can be applied to the column
   */
  makeSearchTextFilter(
    column: DhType.Column,
    searchText: string,
    timeZone: string
  ): DhType.FilterCondition {
    const valueType = this.getValueType(column.type);

    try {
      if (valueType === this.dh.ValueType.BOOLEAN) {
        const maybeFilterCondition = this.makeQuickBooleanFilter(
          column,
          searchText
        );
        assertNotNull(maybeFilterCondition);
        return maybeFilterCondition;
      }

      if (valueType === this.dh.ValueType.DATETIME) {
        return this.makeQuickDateFilterWithOperation(
          column,
          DateUtils.trimDateTimeStringTimeZone(searchText),
          'eq',
          timeZone
        );
      }

      if (valueType === this.dh.ValueType.NUMBER) {
        const maybeFilterCondition = this.makeQuickNumberFilter(
          column,
          searchText
        );
        assertNotNull(maybeFilterCondition);
        return maybeFilterCondition;
      }

      // Treat big numbers as strings
      if (
        TableUtils.isBigDecimalType(column.type) ||
        TableUtils.isBigIntegerType(column.type)
      ) {
        return column
          .filter()
          .eq(this.makeFilterValue(column.type, searchText));
      }

      return column
        .filter()
        .containsIgnoreCase(this.makeFilterValue(column.type, searchText));
    } catch {
      return this.makeNeverFilter(column);
    }
  }

  /**
   * Apply a filter to a table that won't match anything.
   * @table The table to apply the filter to
   * @columnName The name of the column to apploy the filter to
   * @param timeout Timeout before cancelling the promise that waits for the next
   * dh.Table.EVENT_FILTERCHANGED event
   * @returns a Promise to the Table that resolves after the next
   * dh.Table.EVENT_FILTERCHANGED event
   */
  async applyNeverFilter<T extends DhType.Table | DhType.TreeTable>(
    table: T | null | undefined,
    columnName: string,
    timeout = TableUtils.APPLY_TABLE_CHANGE_TIMEOUT_MS
  ): Promise<T | null> {
    if (table == null) {
      return null;
    }

    const column = table.findColumn(columnName);
    const filters = [this.makeNeverFilter(column)];

    await this.applyFilter(table, filters, timeout);

    return table;
  }

  /**
   * Apply custom columns to a given table. Return a Promise that resolves with
   * the table once the dh.Table.EVENT_CUSTOMCOLUMNSCHANGED event has fired.
   * @param table The table to apply custom columns to.
   * @param columns The list of column expressions or definitions to apply.
   * @returns A Promise that will be resolved with the given table after the
   * columns are applied.
   */
  async applyCustomColumns(
    table: DhType.Table | null | undefined,
    columns: (string | DhType.CustomColumn)[],
    timeout = TableUtils.APPLY_TABLE_CHANGE_TIMEOUT_MS
  ): Promise<DhType.Table | null> {
    const { dh } = this;
    return TableUtils.executeAndWaitForEvent(
      t => t?.applyCustomColumns(columns),
      table,
      dh.Table.EVENT_CUSTOMCOLUMNSCHANGED,
      timeout
    );
  }

  /**
   * Apply filters to a given table.
   * @param table Table to apply filters to
   * @param filters Filters to apply
   * @param timeout Timeout before cancelling the promise that waits for the next
   * dh.Table.EVENT_FILTERCHANGED event
   * @returns a Promise to the Table that resolves after the next
   * dh.Table.EVENT_FILTERCHANGED event
   */
  async applyFilter<T extends DhType.Table | DhType.TreeTable>(
    table: T | null | undefined,
    filters: DhType.FilterCondition[],
    timeout = TableUtils.APPLY_TABLE_CHANGE_TIMEOUT_MS
  ): Promise<T | null> {
    const { dh } = this;
    return TableUtils.executeAndWaitForEvent(
      t => t?.applyFilter(filters),
      table,
      dh.Table.EVENT_FILTERCHANGED,
      timeout
    );
  }

  /**
   * Apply sorts to a given Table.
   * @param table The table to apply sorts to
   * @param sorts The sorts to apply
   * @param timeout Timeout before cancelling the promise that waits for the next
   * dh.Table.EVENT_SORTCHANGED event
   * @returns a Promise to the Table that resolves after the next
   * dh.Table.EVENT_SORTCHANGED event
   */
  async applySort<T extends DhType.Table | DhType.TreeTable>(
    table: T | null | undefined,
    sorts: DhType.Sort[],
    timeout = TableUtils.APPLY_TABLE_CHANGE_TIMEOUT_MS
  ): Promise<T | null> {
    const { dh } = this;
    return TableUtils.executeAndWaitForEvent(
      t => t?.applySort(sorts),
      table,
      dh.Table.EVENT_SORTCHANGED,
      timeout
    );
  }

  /**
   * Create a filter condition that results in zero results for a given column
   * @param column
   */
  makeNeverFilter(column: DhType.Column): DhType.FilterCondition {
    const { dh } = this;
    let value = null;

    if (TableUtils.isTextType(column.type)) {
      // Use 'a' so that it can work for String or Character types
      value = dh.FilterValue.ofString('a');
    } else if (TableUtils.isBooleanType(column.type)) {
      value = dh.FilterValue.ofBoolean(true);
    } else if (TableUtils.isDateType(column.type)) {
      value = dh.FilterValue.ofNumber(dh.DateWrapper.ofJsDate(new Date()));
    } else {
      value = dh.FilterValue.ofNumber(0);
    }

    const eqFilter = column.filter().eq(value);
    const notEqFilter = column.filter().notEq(value);

    return eqFilter.and(notEqFilter);
  }

  /**
   * @param columnType The column type to make the filter value from.
   * @param value The value to make the filter value from.
   * @returns The FilterValue item for this column/value combination
   */
  makeFilterValue(columnType: string, value: string): DhType.FilterValue {
    const { dh } = this;
    const type = TableUtils.getBaseType(columnType);
    if (TableUtils.isTextType(type)) {
      return dh.FilterValue.ofString(value);
    }
    if (TableUtils.isLongType(type)) {
      return dh.FilterValue.ofNumber(
        dh.LongWrapper.ofString(TableUtils.removeCommas(value))
      );
    }

    return dh.FilterValue.ofNumber(
      TableUtils.removeCommas(value) as unknown as number
    );
  }

  /**
   * Takes a value and converts it to an `dh.FilterValue`
   *
   * @param columnType The column type to make the filter value from.
   * @param value The value to actually set
   * @returns The FilterValue item for this column/value combination
   */
  makeFilterRawValue(
    columnType: string,
    rawValue: unknown
  ): DhType.FilterValue {
    const { dh } = this;
    if (TableUtils.isCharType(columnType)) {
      return dh.FilterValue.ofString(
        typeof rawValue === 'number' ? String.fromCharCode(rawValue) : rawValue
      );
    }
    if (TableUtils.isTextType(columnType)) {
      return dh.FilterValue.ofString(rawValue);
    }

    if (TableUtils.isBooleanType(columnType)) {
      return dh.FilterValue.ofBoolean(rawValue as boolean);
    }

    return dh.FilterValue.ofNumber(rawValue as number);
  }

  /**
   * Creates an Eq filter for the given column and raw value
   * @param column The column to set the filter on
   * @param rawValue The nullable value to filter on
   * @returns The filter for this column/value combination
   */
  makeNullableEqFilter(
    column: DhType.Column,
    rawValue: unknown
  ): DhType.FilterCondition {
    if (rawValue == null) {
      return column.filter().isNull();
    }
    return column.filter().eq(this.makeFilterRawValue(column.type, rawValue));
  }

  /**
   * Converts a string value to a value appropriate for the column
   * @param columnType The column type to make the value for
   * @param text The string value to make a type for
   * @param timeZone The time zone to make this value in if it is a date type. E.g. America/New_York
   */
  makeValue(
    columnType: string,
    text: string,
    timeZone: string
  ): string | number | boolean | DhType.LongWrapper | null {
    const { dh } = this;
    if (text === 'null') {
      return null;
    }
    if (TableUtils.isTextType(columnType)) {
      return text;
    }
    if (TableUtils.isLongType(columnType)) {
      return dh.LongWrapper.ofString(TableUtils.removeCommas(text));
    }
    if (TableUtils.isBooleanType(columnType)) {
      return TableUtils.makeBooleanValue(text, true);
    }
    if (TableUtils.isDateType(columnType)) {
      const [date] = DateUtils.parseDateRange(dh, text, timeZone);
      return date;
    }

    if (TableUtils.isNumberType(columnType)) {
      return TableUtils.makeNumberValue(text);
    }

    log.error('Unexpected column type', columnType);
    return null;
  }

  /**
   * Create a filter using the selected items
   * Has a flag for invertSelection as we start from a "Select All" state and a user just deselects items.
   * Since there may be millions of distinct items, it's easier to build an inverse filter.
   * @param column The column to set the filter on
   * @param selectedValues The values that are selected
   * @param invertSelection Invert the selection (eg. All items are selected, then you deselect items)
   * @returns Returns a `in` or `notIn` FilterCondition as necessary, or null if no filtering should be applied (everything selected)
   */
  makeSelectValueFilter<TInvert extends boolean>(
    column: DhType.Column,
    selectedValues: unknown[],
    invertSelection: TInvert
  ): TInvert extends true
    ? DhType.FilterCondition | null
    : DhType.FilterCondition {
    const { dh } = this;
    if (selectedValues.length === 0) {
      if (invertSelection) {
        // No filter means select everything
        return null as TInvert extends true
          ? DhType.FilterCondition | null
          : DhType.FilterCondition;
      }

      // KLUDGE: Return a conflicting filter to show no results.
      // Could recognize this situation at a higher or lower level and pause updates on the
      // table, but this situation should be rare and that wouldn't be much gains for some added complexity
      return this.makeNeverFilter(column);
    }

    const values = [];
    let isNullSelected = false;
    for (let i = 0; i < selectedValues.length; i += 1) {
      const value = selectedValues[i];
      if (value == null) {
        isNullSelected = true;
      } else if (TableUtils.isTextType(column.type)) {
        values.push(
          dh.FilterValue.ofString(
            typeof value === 'number' ? String.fromCharCode(value) : value
          )
        );
      } else if (TableUtils.isBooleanType(column.type)) {
        values.push(dh.FilterValue.ofBoolean(Boolean(value)));
      } else {
        values.push(dh.FilterValue.ofNumber(value as number));
      }
    }

    if (isNullSelected) {
      if (values.length > 0) {
        if (invertSelection) {
          return column
            .filter()
            .isNull()
            .not()
            .and(column.filter().notIn(values));
        }
        return column.filter().isNull().or(column.filter().in(values));
      }
      if (invertSelection) {
        return column.filter().isNull().not();
      }

      return column.filter().isNull();
    }

    if (invertSelection) {
      return column.filter().notIn(values);
    }

    return column.filter().in(values);
  }
}

export default TableUtils;
