import CorePanelImport from './CorePanel';

export { default as ChartPanel } from './ChartPanel';
export * from './ChartPanel';
export * from './ChartPanelUtils';
export { default as CommandHistoryPanel } from './CommandHistoryPanel';
export { default as ConsolePanel } from './ConsolePanel';
export { default as DropdownFilterPanel } from './DropdownFilterPanel';
export { default as FileExplorerPanel } from './FileExplorerPanel';
export { default as FilterSetManager } from './FilterSetManager';
export type { FilterSet } from './FilterSetManager';
export { default as FilterSetManagerPanel } from './FilterSetManagerPanel';
export { default as InputFilterPanel } from './InputFilterPanel';
export { default as IrisGridPanel } from './IrisGridPanel';
export * from './IrisGridPanel';
export * from './IrisGridPanelTypes';
export { default as LogPanel } from './LogPanel';
export { default as MarkdownPanel } from './MarkdownPanel';
export { default as NotebookPanel } from './NotebookPanel';
export { default as PandasPanel } from './PandasPanel';
export * from './PandasPanel';
export * from './WidgetPanelTypes';
export { default as WidgetPanel, type WidgetPanelProps } from './WidgetPanel';
export { default as WidgetPanelTooltip } from './WidgetPanelTooltip';
export { default as MockFileStorage } from './MockFileStorage';
export const CorePanel = CorePanelImport;

/**
 * @deprecated Use CorePanel instead.
 */
export const Panel = CorePanelImport;
