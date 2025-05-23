import dh from '@deephaven/jsapi-shim';
import { type Data } from 'plotly.js';
import ChartTestUtils from './ChartTestUtils';
import FigureChartModel from './FigureChartModel';

const chartTestUtils = new ChartTestUtils(dh);

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

it('populates the layout properly', () => {
  const figure = chartTestUtils.makeFigure();
  const model = new FigureChartModel(dh, figure);

  expect(model.getLayout()).toEqual(
    expect.objectContaining({
      title: expect.objectContaining({
        text: ChartTestUtils.DEFAULT_FIGURE_TITLE,
      }),
      xaxis: expect.objectContaining({
        title: expect.objectContaining({
          text: ChartTestUtils.DEFAULT_X_TITLE,
        }),
      }),
      yaxis: expect.objectContaining({
        title: expect.objectContaining({
          text: ChartTestUtils.DEFAULT_Y_TITLE,
        }),
      }),
      annotations: expect.arrayContaining([
        expect.objectContaining({
          text: ChartTestUtils.DEFAULT_CHART_TITLE,
          xref: 'x1 domain',
          yref: 'y1 domain',
        }),
      ]),
    })
  );
});

it('populates series data properly', () => {
  const figure = chartTestUtils.makeFigure();
  const model = new FigureChartModel(dh, figure);

  expect(model.getData()).toEqual([
    expect.objectContaining({
      mode: 'markers',
      name: ChartTestUtils.DEFAULT_SERIES_NAME,
    }),
  ]);

  expect(model.getData()).not.toEqual([
    expect.objectContaining({
      orientation: 'h',
    }),
  ]);
});

it('populates horizontal series properly', () => {
  const axes = chartTestUtils.makeDefaultAxes();
  let sources = axes.map(axis => chartTestUtils.makeSource({ axis }));
  sources = [sources[1], sources[0]];
  const series = chartTestUtils.makeSeries({ sources });
  const chart = chartTestUtils.makeChart({ series: [series], axes });
  const figure = chartTestUtils.makeFigure({ charts: [chart] });

  const model = new FigureChartModel(dh, figure);

  expect(model.getData()).toEqual([
    expect.objectContaining({ orientation: 'h' }),
  ]);
});

it('converts histograms properly to bars', () => {
  const series = chartTestUtils.makeSeries({
    plotStyle: dh.plot.SeriesPlotStyle.HISTOGRAM,
  });
  const chart = chartTestUtils.makeChart({ series: [series] });
  const figure = chartTestUtils.makeFigure({ charts: [chart] });
  const model = new FigureChartModel(dh, figure);

  expect(model.getData()).toEqual([
    expect.objectContaining({
      name: ChartTestUtils.DEFAULT_SERIES_NAME,
      type: 'bar',
      width: [],
      marker: expect.objectContaining({
        line: {},
      }),
    }),
  ]);
});

it('handles colors on line charts properly', () => {
  const lineColor = '#123fff';
  const shapeColor = '#abc999';
  const series = chartTestUtils.makeSeries({
    plotStyle: dh.plot.SeriesPlotStyle.LINE,
    lineColor,
    shapeColor,
  });
  const chart = chartTestUtils.makeChart({ series: [series] });
  const figure = chartTestUtils.makeFigure({ charts: [chart] });
  const model = new FigureChartModel(dh, figure);

  expect(model.getData()).toEqual([
    expect.objectContaining({
      marker: expect.objectContaining({
        color: shapeColor,
      }),
      line: expect.objectContaining({
        color: lineColor,
      }),
    }),
  ]);
});

it('handles colors on bar charts properly', () => {
  const lineColor = '#badfad';
  const series = chartTestUtils.makeSeries({
    plotStyle: dh.plot.SeriesPlotStyle.BAR,
    lineColor,
  });
  const chart = chartTestUtils.makeChart({ series: [series] });
  const figure = chartTestUtils.makeFigure({ charts: [chart] });
  const model = new FigureChartModel(dh, figure);

  expect(model.getData()).toEqual([
    expect.objectContaining({
      marker: expect.objectContaining({
        color: lineColor,
      }),
    }),
  ]);
});

it('updates the title correctly', () => {
  const figure = chartTestUtils.makeFigure();
  const model = new FigureChartModel(dh, figure);
  const mockSubscribe = jest.fn();
  model.subscribe(mockSubscribe);

  model.setTitle('New Title');
  expect(mockSubscribe).toHaveBeenCalledTimes(1);
  expect(mockSubscribe).toHaveBeenCalledWith(
    expect.objectContaining({
      type: FigureChartModel.EVENT_LAYOUT_UPDATED,
      detail: { title: { text: 'New Title', pad: { t: 8 } } },
    })
  );
});

describe('axis transform tests', () => {
  it('handles log x-axis properly', () => {
    const xAxis = chartTestUtils.makeAxis({
      label: ChartTestUtils.DEFAULT_X_TITLE,
      type: dh.plot.AxisType.X,
      log: true,
    });
    const yAxis = chartTestUtils.makeAxis({
      label: ChartTestUtils.DEFAULT_Y_TITLE,
      type: dh.plot.AxisType.Y,
    });
    const axes = [xAxis, yAxis];
    const sources = axes.map(axis => chartTestUtils.makeSource({ axis }));
    const series = chartTestUtils.makeSeries({ sources });
    const chart = chartTestUtils.makeChart({ series: [series], axes });
    const figure = chartTestUtils.makeFigure({ charts: [chart] });
    const model = new FigureChartModel(dh, figure);

    expect(model.getLayout().xaxis).toMatchObject({
      type: 'log',
    });
    expect(model.getLayout().yaxis).not.toMatchObject({
      type: 'log',
    });
  });

  it('handles log y-axis properly', () => {
    const xAxis = chartTestUtils.makeAxis({
      label: ChartTestUtils.DEFAULT_X_TITLE,
      type: dh.plot.AxisType.X,
    });
    const yAxis = chartTestUtils.makeAxis({
      label: ChartTestUtils.DEFAULT_Y_TITLE,
      type: dh.plot.AxisType.Y,
      log: true,
    });
    const axes = [xAxis, yAxis];
    const sources = axes.map(axis => chartTestUtils.makeSource({ axis }));
    const series = chartTestUtils.makeSeries({ sources });
    const chart = chartTestUtils.makeChart({ series: [series], axes });
    const figure = chartTestUtils.makeFigure({ charts: [chart] });
    const model = new FigureChartModel(dh, figure);

    expect(model.getLayout().xaxis).not.toMatchObject({
      type: 'log',
    });
    expect(model.getLayout().yaxis).toMatchObject({
      type: 'log',
    });
  });
});

describe('multiple axes', () => {
  it('handles two y-axes properly', () => {
    const xaxis = chartTestUtils.makeAxis({
      label: 'x1',
      type: dh.plot.AxisType.X,
      position: dh.plot.AxisPosition.BOTTOM,
    });

    const yaxis1 = chartTestUtils.makeAxis({
      label: 'y1',
      type: dh.plot.AxisType.Y,
      position: dh.plot.AxisPosition.LEFT,
    });

    const yaxis2 = chartTestUtils.makeAxis({
      label: 'y2',
      type: dh.plot.AxisType.Y,
      position: dh.plot.AxisPosition.RIGHT,
    });
    const axes = [xaxis, yaxis1, yaxis2];

    const chart = chartTestUtils.makeChart({ axes });
    const figure = chartTestUtils.makeFigure({ charts: [chart] });
    const model = new FigureChartModel(dh, figure);

    const layout = model.getLayout();

    expect(layout.xaxis).toEqual(
      expect.objectContaining({
        side: 'bottom',
        title: expect.objectContaining({ text: 'x1' }),
      })
    );

    expect(layout.yaxis).toEqual(
      expect.objectContaining({
        side: 'left',
        title: expect.objectContaining({ text: 'y1' }),
      })
    );

    expect(layout.yaxis2).toEqual(
      expect.objectContaining({
        side: 'right',
        title: expect.objectContaining({ text: 'y2' }),
        overlaying: 'y',
      })
    );
  });

  it('handles multiple y-axes on the same side properly', () => {
    const xaxis = chartTestUtils.makeAxis({
      label: 'x1',
      type: dh.plot.AxisType.X,
      position: dh.plot.AxisPosition.BOTTOM,
    });

    const yaxis1 = chartTestUtils.makeAxis({
      label: 'y1',
      type: dh.plot.AxisType.Y,
      position: dh.plot.AxisPosition.RIGHT,
    });

    const yaxis2 = chartTestUtils.makeAxis({
      label: 'y2',
      type: dh.plot.AxisType.Y,
      position: dh.plot.AxisPosition.RIGHT,
    });

    const yaxis3 = chartTestUtils.makeAxis({
      label: 'y3',
      type: dh.plot.AxisType.Y,
      position: dh.plot.AxisPosition.RIGHT,
    });

    const axes = [xaxis, yaxis1, yaxis2, yaxis3];

    const chart = chartTestUtils.makeChart({ axes });
    const figure = chartTestUtils.makeFigure({ charts: [chart] });
    const model = new FigureChartModel(dh, figure);

    const layout = model.getLayout();

    expect(layout.xaxis).toEqual(
      expect.objectContaining({
        side: 'bottom',
        title: expect.objectContaining({ text: 'x1' }),
        domain: [0, 0.55],
      })
    );

    expect(layout.yaxis).toEqual(
      expect.objectContaining({
        side: 'right',
        title: expect.objectContaining({ text: 'y1' }),
      })
    );

    expect(layout.yaxis2).toEqual(
      expect.objectContaining({
        side: 'right',
        title: expect.objectContaining({ text: 'y2' }),
        overlaying: 'y',
        position: 0.7,
        anchor: 'free',
      })
    );

    expect(layout.yaxis3).toEqual(
      expect.objectContaining({
        side: 'right',
        title: expect.objectContaining({ text: 'y3' }),
        overlaying: 'y',
        position: 0.85,
        anchor: 'free',
      })
    );
  });

  it('handles two x-axes properly', () => {
    const xaxis1 = chartTestUtils.makeAxis({
      label: 'x1',
      type: dh.plot.AxisType.X,
      position: dh.plot.AxisPosition.BOTTOM,
    });

    const xaxis2 = chartTestUtils.makeAxis({
      label: 'x2',
      type: dh.plot.AxisType.X,
      position: dh.plot.AxisPosition.TOP,
    });

    const yaxis = chartTestUtils.makeAxis({
      label: 'y1',
      type: dh.plot.AxisType.Y,
      position: dh.plot.AxisPosition.LEFT,
    });
    const axes = [xaxis1, xaxis2, yaxis];

    const chart = chartTestUtils.makeChart({ axes });
    const figure = chartTestUtils.makeFigure({ charts: [chart] });
    const model = new FigureChartModel(dh, figure);

    const layout = model.getLayout();

    expect(layout.xaxis).toEqual(
      expect.objectContaining({
        side: 'bottom',
        title: expect.objectContaining({ text: 'x1' }),
      })
    );

    expect(layout.xaxis2).toEqual(
      expect.objectContaining({
        side: 'top',
        title: expect.objectContaining({ text: 'x2' }),
        overlaying: 'x',
      })
    );

    expect(layout.yaxis).toEqual(
      expect.objectContaining({
        side: 'left',
        title: expect.objectContaining({ text: 'y1' }),
      })
    );
  });

  it('handles multiple x-axes on the same side properly', () => {
    const xaxis = chartTestUtils.makeAxis({
      label: 'x1',
      type: dh.plot.AxisType.X,
      position: dh.plot.AxisPosition.TOP,
    });

    const xaxis2 = chartTestUtils.makeAxis({
      label: 'x2',
      type: dh.plot.AxisType.X,
      position: dh.plot.AxisPosition.TOP,
    });

    const xaxis3 = chartTestUtils.makeAxis({
      label: 'x3',
      type: dh.plot.AxisType.X,
      position: dh.plot.AxisPosition.TOP,
    });

    const yaxis = chartTestUtils.makeAxis({
      label: 'y1',
      type: dh.plot.AxisType.Y,
      position: dh.plot.AxisPosition.LEFT,
    });

    const axes = [xaxis, xaxis2, xaxis3, yaxis];

    const chart = chartTestUtils.makeChart({ axes });
    const figure = chartTestUtils.makeFigure({ charts: [chart] });
    const model = new FigureChartModel(dh, figure);

    const layout = model.getLayout();

    expect(layout.xaxis).toEqual(
      expect.objectContaining({
        side: 'top',
        title: expect.objectContaining({ text: 'x1' }),
      })
    );

    expect(layout.xaxis2).toEqual(
      expect.objectContaining({
        side: 'top',
        title: expect.objectContaining({ text: 'x2' }),
        overlaying: 'x',
        position: 0.85,
        anchor: 'free',
      })
    );

    expect(layout.xaxis3).toEqual(
      expect.objectContaining({
        side: 'top',
        title: expect.objectContaining({ text: 'x3' }),
        overlaying: 'x',
        position: 1,
        anchor: 'free',
      })
    );

    expect(layout.yaxis).toEqual(
      expect.objectContaining({
        side: 'left',
        title: expect.objectContaining({ text: 'y1' }),
        domain: [0, 0.7],
      })
    );
  });
});

it('adds new series', () => {
  const series1 = chartTestUtils.makeSeries({ name: 'S1' });
  const chart = chartTestUtils.makeChart({ series: [series1] });
  const figure = chartTestUtils.makeFigure({
    charts: [chart],
  });
  const model = new FigureChartModel(dh, figure);
  model.subscribe(jest.fn());

  expect(model.getData()).toEqual([
    expect.objectContaining({
      mode: 'markers',
      name: 'S1',
    }),
  ]);

  const series2 = chartTestUtils.makeSeries({ name: 'S2' });
  chart.series = [...chart.series, series2];

  figure.fireEvent(dh.plot.Figure.EVENT_SERIES_ADDED, series2);

  jest.runOnlyPendingTimers();

  expect(model.getData()).toEqual([
    expect.objectContaining({
      mode: 'markers',
      name: 'S1',
    }),
    expect.objectContaining({
      mode: 'markers',
      name: 'S2',
    }),
  ]);
});

it('emits finished loading if no series are added', () => {
  const figure = chartTestUtils.makeFigure({
    charts: [],
  });
  const model = new FigureChartModel(dh, figure);
  const callback = jest.fn();
  model.subscribe(callback);

  jest.runOnlyPendingTimers();

  expect(callback).toHaveBeenCalledWith(
    expect.objectContaining({
      type: FigureChartModel.EVENT_LOADFINISHED,
    })
  );
});

describe('legend visibility', () => {
  function testLegend(showLegend: boolean | null): Partial<Data>[] {
    const series1 = chartTestUtils.makeSeries({ name: 'S1' });
    const chart = chartTestUtils.makeChart({ series: [series1], showLegend });
    const figure = chartTestUtils.makeFigure({
      charts: [chart],
    });
    const model = new FigureChartModel(dh, figure);
    model.subscribe(jest.fn());

    return model.getData();
  }

  it('shows legend when set to true', () => {
    expect(testLegend(true)).toEqual([
      expect.objectContaining({
        showlegend: true,
      }),
    ]);
  });

  it('hides legend when set to false', () => {
    expect(testLegend(false)).toEqual([
      expect.objectContaining({
        showlegend: false,
      }),
    ]);
  });

  it('does not set property when not provided', () => {
    expect(testLegend(null)).toEqual([
      expect.objectContaining({ showlegend: undefined }),
    ]);
  });
});

it('handles axes min and max properly', () => {
  const xaxis = chartTestUtils.makeAxis({
    label: 'x1',
    type: dh.plot.AxisType.X,
    position: dh.plot.AxisPosition.BOTTOM,
    minRange: 0,
    maxRange: 100,
  });

  const xaxis2 = chartTestUtils.makeAxis({
    label: 'x1',
    type: dh.plot.AxisType.X,
    position: dh.plot.AxisPosition.BOTTOM,
    log: true,
    minRange: 100,
    maxRange: 1000,
  });

  const yaxis1 = chartTestUtils.makeAxis({
    label: 'y1',
    type: dh.plot.AxisType.Y,
    position: dh.plot.AxisPosition.LEFT,
    maxRange: 200,
  });

  const yaxis2 = chartTestUtils.makeAxis({
    label: 'y2',
    type: dh.plot.AxisType.Y,
    position: dh.plot.AxisPosition.RIGHT,
    minRange: -10,
  });

  const axes = [xaxis, xaxis2, yaxis1, yaxis2];

  const chart = chartTestUtils.makeChart({ axes });
  const figure = chartTestUtils.makeFigure({ charts: [chart] });
  const model = new FigureChartModel(dh, figure);

  const layout = model.getLayout();

  expect(layout.xaxis?.autorangeoptions?.minallowed).toEqual(0);

  expect(layout.xaxis?.autorangeoptions?.maxallowed).toEqual(100);

  expect(layout.xaxis2?.autorangeoptions?.minallowed).toEqual(2);

  expect(layout.xaxis2?.autorangeoptions?.maxallowed).toEqual(3);

  expect(layout.yaxis?.autorangeoptions?.minallowed).toEqual(undefined);

  expect(layout.yaxis?.autorangeoptions?.maxallowed).toEqual(200);

  expect(layout.yaxis2?.autorangeoptions?.minallowed).toEqual(-10);

  expect(layout.yaxis2?.autorangeoptions?.maxallowed).toEqual(undefined);
});
