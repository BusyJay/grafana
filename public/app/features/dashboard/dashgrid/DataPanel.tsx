// Library
import React, { Component } from 'react';

// Services
import { DatasourceSrv, getDatasourceSrv } from 'app/features/plugins/datasource_srv';
// Types
import {
  DataQueryResponse,
  DataQueryError,
  LoadingState,
  SeriesData,
  TimeRange,
  ScopedVars,
  toSeriesData,
  guessFieldTypes,
} from '@grafana/ui';

interface RenderProps {
  loading: LoadingState;
  data: SeriesData[];
}

export interface Props {
  datasource: string | null;
  queries: any[];
  panelId: number;
  dashboardId?: number;
  isVisible?: boolean;
  timeRange?: TimeRange;
  widthPixels: number;
  refreshCounter: number;
  minInterval?: string;
  maxDataPoints?: number;
  scopedVars?: ScopedVars;
  children: (r: RenderProps) => JSX.Element;
  onDataResponse?: (data: DataQueryResponse) => void;
  onError: (message: string, error: DataQueryError) => void;
}

export interface State {
  isFirstLoad: boolean;
  loading: LoadingState;
  response: DataQueryResponse;
  data?: SeriesData[];
}

/**
 * All panels will be passed tables that have our best guess at colum type set
 *
 * This is also used by PanelChrome for snapshot support
 */
export function getProcessedSeriesData(results?: any[]): SeriesData[] {
  if (!results) {
    return [];
  }

  const series: SeriesData[] = [];
  for (const r of results) {
    if (r) {
      series.push(guessFieldTypes(toSeriesData(r)));
    }
  }
  return series;
}

export class DataPanel extends Component<Props, State> {
  static defaultProps = {
    isVisible: true,
    dashboardId: 1,
  };

  dataSourceSrv: DatasourceSrv = getDatasourceSrv();
  isUnmounted = false;

  constructor(props: Props) {
    super(props);

    this.state = {
      loading: LoadingState.NotStarted,
      response: {
        data: [],
      },
      isFirstLoad: true,
    };
  }

  componentDidMount() {
    this.issueQueries();
  }

  componentWillUnmount() {
    this.isUnmounted = true;
  }

  async componentDidUpdate(prevProps: Props) {
    if (!this.hasPropsChanged(prevProps)) {
      return;
    }

    this.issueQueries();
  }

  hasPropsChanged(prevProps: Props) {
    return this.props.refreshCounter !== prevProps.refreshCounter;
  }

  private issueQueries = async () => {
    const { isVisible, queries, onError } = this.props;

    if (!isVisible) {
      return;
    }

    if (!queries.length) {
      this.setState({ loading: LoadingState.Done });
      return;
    }

    this.setState({ loading: LoadingState.Loading });

    try {
      if (this.isUnmounted) {
        return;
      }

      this.setState({
        loading: LoadingState.Done,
        isFirstLoad: false,
      });
    } catch (err) {
      console.log('DataPanel error', err);

      let message = 'Query error';

      if (err.message) {
        message = err.message;
      } else if (err.data && err.data.message) {
        message = err.data.message;
      } else if (err.data && err.data.error) {
        message = err.data.error;
      } else if (err.status) {
        message = `Query error: ${err.status} ${err.statusText}`;
      }

      onError(message, err);
      this.setState({ isFirstLoad: false, loading: LoadingState.Error });
    }
  };

  render() {
    const { queries } = this.props;
    const { loading, isFirstLoad, data } = this.state;

    // do not render component until we have first data
    if (isFirstLoad && (loading === LoadingState.Loading || loading === LoadingState.NotStarted)) {
      return this.renderLoadingState();
    }

    if (!queries.length) {
      return (
        <div className="panel-empty">
          <p>Add a query to get some data!</p>
        </div>
      );
    }

    return (
      <>
        {loading === LoadingState.Loading && this.renderLoadingState()}
        {this.props.children({ loading, data })}
      </>
    );
  }

  private renderLoadingState(): JSX.Element {
    return (
      <div className="panel-loading">
        <i className="fa fa-spinner fa-spin" />
      </div>
    );
  }
}
