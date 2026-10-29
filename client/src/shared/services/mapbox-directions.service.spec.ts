import { TestBed } from '@angular/core/testing';
import { MAPBOX_DIRECTIONS_TOKEN, MapboxDirectionsService } from './mapbox-directions.service';

describe('Mapbox walking Directions', () => {
  const points = [
    { longitude: 121.46, latitude: 25.01 },
    { longitude: 121.464, latitude: 25.014 },
  ];
  const geometry = [
    [121.46, 25.01],
    [121.461, 25.012],
    [121.464, 25.014],
  ];
  const responseData = {
    code: 'Ok',
    routes: [{ distance: 1234, duration: 987, geometry: { type: 'LineString', coordinates: geometry } }],
    waypoints: points.map((point) => ({ location: [point.longitude, point.latitude] })),
  };

  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [{ provide: MAPBOX_DIRECTIONS_TOKEN, useValue: 'pk.test' }],
    }),
  );
  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('requests walking, full GeoJSON geometry and returns the actual road shape and distance', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(responseData));
    const route = await TestBed.inject(MapboxDirectionsService).walking(
      points,
      new AbortController().signal,
    );
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBeInstanceOf(URL);
    if (!(url instanceof URL)) throw new Error('Expected a Directions URL');
    expect(url.pathname).toBe('/directions/v5/mapbox/walking/121.46,25.01;121.464,25.014');
    expect(url.searchParams.get('geometries')).toBe('geojson');
    expect(url.searchParams.get('overview')).toBe('full');
    expect(route.distanceMeters).toBe(1234);
    expect(route.durationSeconds).toBe(987);
    expect(route.coordinates).toEqual(
      geometry.map(([longitude, latitude]) => ({ longitude, latitude })),
    );
    expect(route.waypoints).toEqual(points);
  });

  it('routes more than twenty-three optional stops in overlapping batches without losing their order', async () => {
    const many = Array.from({length: 52}, (_, i) => ({longitude: 121.46 + i * 0.0001, latitude: 25.01}));
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = input as URL;
      const coordinates = url.pathname.split('/').at(-1)!.split(';').map(pair => pair.split(',').map(Number));
      return Response.json({code: 'Ok', routes: [{distance: 1000, duration: 800, geometry: {type: 'LineString', coordinates}}],
        waypoints: coordinates.map(location => ({location}))});
    });
    const result = await TestBed.inject(MapboxDirectionsService).walking(many, new AbortController().signal);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result.waypoints).toEqual(many);
    expect(result.coordinates).toEqual(many);
    expect(result.distanceMeters).toBe(3000);
    expect(result.durationSeconds).toBe(2400);
  });

  it.each([401, 403, 429, 500])(
    'surfaces HTTP %i without inventing a straight-line route',
    async (status) => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status }));
      await expect(
        TestBed.inject(MapboxDirectionsService).walking(points, new AbortController().signal),
      ).rejects.toThrow(/Mapbox/);
    },
  );

  it.each(['NoRoute', 'NoSegment'])('surfaces %s', async (code) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code }));
    await expect(
      TestBed.inject(MapboxDirectionsService).walking(points, new AbortController().signal),
    ).rejects.toThrow('找不到可步行');
  });

  it('rejects missing tokens and invalid coordinates before making a request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    TestBed.overrideProvider(MAPBOX_DIRECTIONS_TOKEN, { useValue: '' });
    const service = TestBed.inject(MapboxDirectionsService);
    await expect(service.walking(points, new AbortController().signal)).rejects.toThrow('token');
    await expect(
      service.walking([{ longitude: NaN, latitude: 0 }, points[0]], new AbortController().signal),
    ).rejects.toThrow('有效座標');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('validates geometry rather than accepting a success code alone', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        ...responseData,
        routes: [
          {
            distance: 123,
            geometry: {
              type: 'LineString',
              coordinates: [
                [181, 0],
                [121, 25],
              ],
            },
          },
        ],
      }),
    );
    await expect(
      TestBed.inject(MapboxDirectionsService).walking(points, new AbortController().signal),
    ).rejects.toThrow('有效範圍');
  });

  it('propagates cancellation and translates timeout failures', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    const service = TestBed.inject(MapboxDirectionsService);
    await expect(service.walking(points, new AbortController().signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    fetchMock.mockRejectedValue(new DOMException('timeout', 'TimeoutError'));
    await expect(service.walking(points, new AbortController().signal)).rejects.toThrow('逾時');
  });
});
