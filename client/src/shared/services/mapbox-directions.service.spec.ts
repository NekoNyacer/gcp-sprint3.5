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
    routes: [{ distance: 1234, geometry: { type: 'LineString', coordinates: geometry } }],
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
    expect(route.coordinates).toEqual(
      geometry.map(([longitude, latitude]) => ({ longitude, latitude })),
    );
    expect(route.waypoints).toEqual(points);
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
