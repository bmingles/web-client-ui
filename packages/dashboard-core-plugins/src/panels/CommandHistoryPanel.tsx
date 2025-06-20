import React, { Component, type RefObject } from 'react';
import { connect } from 'react-redux';
import { type ContextAction, ContextActions } from '@deephaven/components';
import {
  CommandHistory,
  type CommandHistoryStorage,
  SHORTCUTS,
  type CommandHistorySettings,
  type CommandHistoryTable,
} from '@deephaven/console';
import { type DashboardPanelProps } from '@deephaven/dashboard';
import Log from '@deephaven/log';
import { getCommandHistoryStorage, type RootState } from '@deephaven/redux';
import { assertNotNull, Pending } from '@deephaven/utils';
import type { dh } from '@deephaven/jsapi-types';
import { ConsoleEvent, NotebookEvent } from '../events';
import './CommandHistoryPanel.scss';
import Panel from './CorePanel';
import { getDashboardSessionWrapper } from '../redux';

const log = Log.module('CommandHistoryPanel');

interface CommandHistoryPanelProps extends DashboardPanelProps {
  // eslint-disable-next-line react/no-unused-prop-types
  panelState?: Record<string, never>;
  session?: dh.IdeSession;
  sessionId?: string;
  language?: string;
  commandHistoryStorage: CommandHistoryStorage;
}

interface CommandHistoryPanelState {
  panelState: Record<string, never>;
  session?: dh.IdeSession;
  sessionId?: string;
  language?: string;
  contextActions: ContextAction[];
  table?: CommandHistoryTable;
}

class CommandHistoryPanel extends Component<
  CommandHistoryPanelProps,
  CommandHistoryPanelState
> {
  static COMPONENT = 'CommandHistoryPanel';

  static TITLE = 'Command History';

  static handleError(error: unknown): void {
    log.error(error);
  }

  constructor(props: CommandHistoryPanelProps) {
    super(props);

    this.handleFocusHistory = this.handleFocusHistory.bind(this);
    this.handleSessionOpened = this.handleSessionOpened.bind(this);
    this.handleSessionClosed = this.handleSessionClosed.bind(this);
    this.handleShow = this.handleShow.bind(this);
    this.handleSendToConsole = this.handleSendToConsole.bind(this);
    this.handleSendToNotebook = this.handleSendToNotebook.bind(this);

    this.container = React.createRef();
    this.pending = new Pending();

    const { session, sessionId, language } = props;

    this.state = {
      // eslint-disable-next-line react/no-unused-state
      panelState: {},
      session,
      sessionId,
      language,
      contextActions: [
        {
          action: this.handleFocusHistory,
          shortcut: SHORTCUTS.COMMAND_HISTORY.FOCUS_HISTORY,
        },
      ],
    };
  }

  componentDidMount(): void {
    const { glEventHub, session } = this.props;
    glEventHub.on(ConsoleEvent.FOCUS_HISTORY, this.handleFocusHistory);
    if (session != null) {
      this.loadTable();
    }
  }

  componentWillUnmount(): void {
    const { glEventHub } = this.props;
    glEventHub.off(ConsoleEvent.FOCUS_HISTORY, this.handleFocusHistory);

    this.pending.cancel();
  }

  container: RefObject<CommandHistory>;

  pending: Pending;

  handleFocusHistory(): void {
    if (this.container.current) {
      this.container.current.focus();
    }
  }

  handleShow(): void {
    // virtual list requires a forced reset to scroll position when picked up and dropped in same place
    this.container.current?.restoreScrollPosition();
  }

  handleSessionOpened(
    session: dh.IdeSession,
    { language, sessionId }: { language: string; sessionId: string }
  ): void {
    this.setState(
      {
        session,
        sessionId,
        language,
      },
      () => {
        this.loadTable();
      }
    );
  }

  handleSessionClosed(): void {
    this.pending.cancel();
    this.setState({
      session: undefined,
      language: undefined,
      table: undefined,
    });
  }

  handleSendToNotebook(
    settings: CommandHistorySettings,
    forceNewNotebook = false
  ): void {
    const { session, language } = this.state;
    log.debug('handleSendToNotebook', session, settings);
    if (!session) {
      log.error('Session is not connected.');
      return;
    }
    const { glEventHub } = this.props;
    glEventHub.emit(
      forceNewNotebook
        ? NotebookEvent.CREATE_NOTEBOOK
        : NotebookEvent.SEND_TO_NOTEBOOK,
      session,
      language,
      settings
    );
  }

  handleSendToConsole(command: string, focus = true, execute = false): void {
    log.debug('handleSendToConsole', command);
    const { glEventHub } = this.props;
    glEventHub.emit(ConsoleEvent.SEND_COMMAND, command, focus, execute);
  }

  loadTable(): void {
    const { commandHistoryStorage } = this.props;
    const { language, sessionId } = this.state;
    assertNotNull(language);
    assertNotNull(sessionId);
    this.pending
      .add(
        commandHistoryStorage.getTable(language, sessionId, Date.now()),
        resolved => resolved.close()
      )
      .then(table => {
        this.setState({ table });
      })
      .catch(CommandHistoryPanel.handleError);
  }

  render(): JSX.Element {
    const { glContainer, glEventHub, commandHistoryStorage } = this.props;
    const { language, contextActions, table } = this.state;
    return (
      <Panel
        className="command-history-pane"
        componentPanel={this}
        glContainer={glContainer}
        glEventHub={glEventHub}
        onSessionOpen={this.handleSessionOpened}
        onSessionClose={this.handleSessionClosed}
        onShow={this.handleShow}
      >
        {!table && (
          <div className="command-history-disconnected-message">
            Waiting for console connection
          </div>
        )}
        {table && language != null && (
          <>
            <CommandHistory
              ref={this.container}
              language={language}
              sendToNotebook={this.handleSendToNotebook}
              sendToConsole={this.handleSendToConsole}
              table={table}
              commandHistoryStorage={commandHistoryStorage}
            />
            <ContextActions actions={contextActions} />
          </>
        )}
      </Panel>
    );
  }
}

const mapStateToProps = (
  state: RootState,
  ownProps: { localDashboardId: string }
): Pick<
  CommandHistoryPanelProps,
  'commandHistoryStorage' | 'language' | 'session' | 'sessionId'
> => {
  const commandHistoryStorage = getCommandHistoryStorage(
    state
  ) as CommandHistoryStorage;
  const sessionWrapper = getDashboardSessionWrapper(
    state,
    ownProps.localDashboardId
  );
  const { session, config: sessionConfig } = sessionWrapper ?? {};
  const { type: language, id: sessionId } = sessionConfig ?? {};

  return {
    commandHistoryStorage,
    language,
    session,
    sessionId,
  };
};

const ConnectedCommandHistoryPanel = connect(mapStateToProps, null, null, {
  forwardRef: true,
})(CommandHistoryPanel);

export default ConnectedCommandHistoryPanel;
