import { type DashboardPanelProps } from '@deephaven/dashboard';
import Log from '@deephaven/log';
import { getFileStorage, type RootState } from '@deephaven/redux';
import FileExplorer, {
  FileExplorerToolbar,
  type FileStorage,
  type FileStorageItem,
  FileUtils,
  NewItemModal,
  isDirectory,
} from '@deephaven/file-explorer';
import React, { type ReactNode } from 'react';
import { connect, type ConnectedProps } from 'react-redux';
import type { dh } from '@deephaven/jsapi-types';
import Panel from './CorePanel';
import { NotebookEvent } from '../events';
import './FileExplorerPanel.scss';
import { getDashboardSessionWrapper } from '../redux';

const log = Log.module('FileExplorerPanel');

type StateProps = {
  fileStorage: FileStorage;
  language?: string;
  session?: dh.IdeSession;
};

type OwnProps = DashboardPanelProps;

const mapStateToProps = (state: RootState, ownProps: OwnProps): StateProps => {
  const fileStorage = getFileStorage(state);
  const sessionWrapper = getDashboardSessionWrapper(
    state,
    ownProps.localDashboardId
  );
  const { session, config: sessionConfig } = sessionWrapper ?? {};
  const language = sessionConfig?.type;

  return {
    fileStorage,
    language,
    session,
  };
};

const connector = connect(mapStateToProps, null, null, { forwardRef: true });

export type FileExplorerPanelProps = OwnProps &
  StateProps &
  ConnectedProps<typeof connector>;

export type FileExplorerPanelState = {
  isShown: boolean;
  language?: string;
  session?: dh.IdeSession;
  showCreateFolder: boolean;
  focusedFilePath: string;
};

function isMouseEvent<T>(e: React.SyntheticEvent<T>): e is React.MouseEvent<T> {
  const mouseEvent = e as React.MouseEvent<T>;
  return mouseEvent != null && typeof mouseEvent.button === 'number';
}

/**
 * Panel for showing a FileExplorer in a Dashboard.
 */
export class FileExplorerPanel extends React.Component<
  FileExplorerPanelProps,
  FileExplorerPanelState
> {
  static COMPONENT = 'FileExplorerPanel';

  static TITLE = 'File Explorer';

  static handleError(error: Error): void {
    log.error(error);
  }

  /**
   * Return true if the event should open a file and focus it, otherwise false
   * @param event The event to check
   */
  static isFocusEvent(event: React.SyntheticEvent): boolean {
    if (isMouseEvent(event)) {
      // If it's not a double click, then it's a preview event
      return event.detail >= 2;
    }

    // Keyboard event should always open with focus
    return true;
  }

  constructor(props: FileExplorerPanelProps) {
    super(props);

    this.handleFileSelect = this.handleFileSelect.bind(this);
    this.handleCopyFile = this.handleCopyFile.bind(this);
    this.handleCreateFile = this.handleCreateFile.bind(this);
    this.handleCreateDirectory = this.handleCreateDirectory.bind(this);
    this.handleCreateDirectoryCancel =
      this.handleCreateDirectoryCancel.bind(this);
    this.handleCreateDirectorySubmit =
      this.handleCreateDirectorySubmit.bind(this);
    this.handleDelete = this.handleDelete.bind(this);
    this.handleRename = this.handleRename.bind(this);
    this.handleSessionOpened = this.handleSessionOpened.bind(this);
    this.handleSessionClosed = this.handleSessionClosed.bind(this);
    this.handleShow = this.handleShow.bind(this);
    this.handleSelectionChange = this.handleSelectionChange.bind(this);

    const { session, language } = props;
    this.state = {
      isShown: false,
      language,
      session,
      showCreateFolder: false,
      focusedFilePath: '/',
    };
  }

  componentDidMount(): void {
    if (!this.isHidden()) {
      this.setState({ isShown: true });
    }
  }

  handleCreateFile(): void {
    const { glEventHub } = this.props;
    const { session, language } = this.state;
    const notebookSettings = {
      language,
      value: '',
    };
    log.debug('handleCreateFile', session, language, notebookSettings);
    glEventHub.emit(
      NotebookEvent.CREATE_NOTEBOOK,
      session,
      language,
      notebookSettings
    );
  }

  handleCreateDirectory(): void {
    this.setState({ showCreateFolder: true });
  }

  handleCreateDirectoryCancel(): void {
    log.debug('handleCreateDirectoryCancel');
    this.setState({
      showCreateFolder: false,
    });
  }

  handleCreateDirectorySubmit(path: string): void {
    log.debug('handleCreateDirectorySubmit', path);
    this.setState({ showCreateFolder: false });
    const { fileStorage } = this.props;
    fileStorage.createDirectory(path).catch(FileExplorerPanel.handleError);
  }

  async handleCopyFile(file: FileStorageItem): Promise<void> {
    const { fileStorage } = this.props;
    if (isDirectory(file)) {
      log.error('Invalid item in handleCopyItem', file);
      return;
    }
    const newName = await FileUtils.getUniqueCopyFileName(
      fileStorage,
      file.filename
    );
    await fileStorage.copyFile(file.filename, newName);
  }

  handleDelete(files: FileStorageItem[]): void {
    const { glEventHub } = this.props;
    files.forEach(file => {
      glEventHub.emit(NotebookEvent.CLOSE_FILE, {
        id: file.filename,
        itemName: file.filename,
      });
    });
  }

  handleSelectionChange(selectedItems: FileStorageItem[]): void {
    let path = '/';
    if (selectedItems.length === 1) {
      if (selectedItems[0].type === 'directory') {
        path = FileUtils.makePath(selectedItems[0].filename);
      } else {
        path = FileUtils.getPath(selectedItems[0].filename);
      }
    }
    this.setState({ focusedFilePath: path });
  }

  handleFileSelect(file: FileStorageItem, event: React.SyntheticEvent): void {
    log.debug('fileSelect', file);
    if (file.type === 'directory') {
      return;
    }

    const shouldFocus = FileExplorerPanel.isFocusEvent(event);
    const fileMetadata = { id: file.filename, itemName: file.filename };
    const { glEventHub } = this.props;
    const { session, language } = this.state;
    const notebookSettings = {
      value: null,
      language,
    };
    glEventHub.emit(
      NotebookEvent.SELECT_NOTEBOOK,
      session,
      language,
      notebookSettings,
      fileMetadata,
      shouldFocus
    );
  }

  handleRename(oldName: string, newName: string): void {
    const { glEventHub } = this.props;
    log.debug('handleRename', oldName, newName);
    glEventHub.emit(NotebookEvent.RENAME_FILE, oldName, newName);
  }

  handleSessionOpened(
    session: dh.IdeSession,
    { language }: { language: string }
  ): void {
    this.setState({
      session,
      language,
    });
  }

  handleSessionClosed(): void {
    this.setState({
      session: undefined,
      language: undefined,
    });
  }

  handleShow(): void {
    this.setState({ isShown: true });
  }

  isHidden(): boolean {
    const { glContainer } = this.props;
    const { isHidden } = glContainer;
    return isHidden;
  }

  render(): ReactNode {
    const { fileStorage, glContainer, glEventHub } = this.props;
    const { isShown, showCreateFolder, focusedFilePath } = this.state;
    return (
      <Panel
        className="file-explorer-panel"
        componentPanel={this}
        glContainer={glContainer}
        glEventHub={glEventHub}
        onSessionOpen={this.handleSessionOpened}
        onSessionClose={this.handleSessionClosed}
        onShow={this.handleShow}
      >
        <FileExplorerToolbar
          createFile={this.handleCreateFile}
          createFolder={this.handleCreateDirectory}
        />
        {isShown && (
          <FileExplorer
            isMultiSelect
            storage={fileStorage}
            onCopy={this.handleCopyFile}
            onCreateFile={this.handleCreateFile}
            onCreateFolder={this.handleCreateDirectory}
            onDelete={this.handleDelete}
            onRename={this.handleRename}
            onSelect={this.handleFileSelect}
            onSelectionChange={this.handleSelectionChange}
          />
        )}
        <NewItemModal
          isOpen={showCreateFolder}
          type="directory"
          title="Create New Folder"
          storage={fileStorage}
          onSubmit={this.handleCreateDirectorySubmit}
          onCancel={this.handleCreateDirectoryCancel}
          defaultValue={focusedFilePath}
        />
      </Panel>
    );
  }
}

const ConnectedFileExplorerPanel = connector(FileExplorerPanel);

export default ConnectedFileExplorerPanel;
