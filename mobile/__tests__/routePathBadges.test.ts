import { getRoutePathBadges } from '../src/utils/accessibility';

const keys = (b: { labelKey: string }[]) => b.map(x => x.labelKey);

describe('getRoutePathBadges', () => {
  it('never claims "no steps" when steps exist anywhere on the path, even if every stop is accessible', () => {
    const badges = getRoutePathBadges(
      { measured: true, stepsMeters: 383, rampedStepsMeters: 8, cobblestonePercent: 37, raisedKerbs: 1, loweredKerbs: 4 },
      [{ wheelchair: 'yes' }, { wheelchair: 'yes' }],
    );
    expect(keys(badges)).not.toContain('routeDetails.stepsFree');
    expect(keys(badges)).not.toContain('routeDetails.rampsOnRoute');
    const steps = badges.find(b => b.labelKey === 'routeDetails.stepsOnRoute');
    expect(steps).toMatchObject({ tone: 'bad', params: { meters: 383 } });
    expect(keys(badges)).toEqual(expect.arrayContaining([
      'routeDetails.raisedKerbs',
      'routeDetails.cobblestone',
      'routeDetails.allStopsWheelchair',
    ]));
  });

  it('shows "no steps on the route" only for 0 m of ramp-less steps', () => {
    const badges = getRoutePathBadges(
      { measured: true, stepsMeters: 0, rampedStepsMeters: 0, cobblestonePercent: 0, raisedKerbs: 0, loweredKerbs: 2 },
      [],
    );
    expect(keys(badges)).toEqual(['routeDetails.stepsFree', 'routeDetails.rampsOnRoute']);
  });

  it('a single metre of steps is still reported', () => {
    const badges = getRoutePathBadges({ measured: true, stepsMeters: 1 }, []);
    expect(keys(badges)).toEqual(['routeDetails.stepsOnRoute']);
  });

  it('unmeasured or missing path is "no data", never "no steps"', () => {
    expect(keys(getRoutePathBadges({ measured: false }, []))).toEqual(['routeDetails.pathNoData']);
    expect(keys(getRoutePathBadges(undefined, []))).toEqual(['routeDetails.pathNoData']);
  });

  it('stop accessibility chip needs every stop to be wheelchair yes/designated', () => {
    const b = getRoutePathBadges({ measured: true, stepsMeters: 0 }, [{ wheelchair: 'yes' }, { wheelchair: 'limited' }]);
    expect(keys(b)).not.toContain('routeDetails.allStopsWheelchair');
  });
});
